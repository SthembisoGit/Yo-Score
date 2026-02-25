import { query } from '../db';
import { challengeService, ChallengePublishStatus } from './challenge.service';
import { challengeTestsService } from './challengeTests.service';
import { ProctoringService } from './proctoring.service';
import { UserService } from './user.service';
import { judgeQueue } from '../queue/judgeQueue';
import { config } from '../config';

const proctoringService = new ProctoringService();
const userService = new UserService();

export class AdminService {
  async getDashboardSummary() {
    const [usersResult, challengesResult, submissionsResult, pendingResult, failedResult] =
      await Promise.all([
        query(`SELECT COUNT(*)::int as count FROM users`),
        query(`SELECT COUNT(*)::int as count FROM challenges`),
        query(`SELECT COUNT(*)::int as count FROM submissions`),
        query(`SELECT COUNT(*)::int as count FROM submissions WHERE judge_status IN ('queued', 'running')`),
        query(`SELECT COUNT(*)::int as count FROM submissions WHERE judge_status = 'failed'`),
      ]);

    const queueCounts = await judgeQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );

    return {
      users_total: usersResult.rows[0].count,
      challenges_total: challengesResult.rows[0].count,
      submissions_total: submissionsResult.rows[0].count,
      judge_pending: pendingResult.rows[0].count,
      judge_failed: failedResult.rows[0].count,
      queue: queueCounts,
    };
  }

  async listChallenges() {
    const challenges = await challengeService.getAllChallenges({ includeUnpublished: true });
    const withReadiness = await Promise.all(
      challenges.map(async (challenge) => {
        const readiness = await challengeService.getChallengeReadiness(challenge.challenge_id);
        return { ...challenge, readiness };
      }),
    );
    return withReadiness;
  }

  async updateChallenge(challengeId: string, data: {
    title?: string;
    description?: string;
    category?: string;
    difficulty?: string;
    target_seniority?: 'graduate' | 'junior' | 'mid' | 'senior';
    duration_minutes?: number;
    supported_languages?: Array<'javascript' | 'python' | 'java' | 'cpp' | 'go' | 'csharp'>;
  }) {
    return challengeService.updateChallenge(challengeId, data);
  }

  async publishChallenge(challengeId: string, status: ChallengePublishStatus) {
    return challengeService.setPublishStatus(challengeId, status);
  }

  async getChallengeReadiness(challengeId: string) {
    return challengeService.getChallengeReadiness(challengeId);
  }

  async listJudgeRuns(limit: number, status?: string) {
    const params: unknown[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE sr.status = $${params.length}`;
    }
    params.push(limit);

    const result = await query(
      `SELECT sr.id, sr.submission_id, sr.language, sr.status, sr.score_correctness, sr.score_efficiency, sr.score_style,
              sr.test_passed, sr.test_total, sr.runtime_ms, sr.memory_mb, sr.error_message, sr.started_at, sr.finished_at,
              s.user_id, s.challenge_id, c.title as challenge_title, u.email as user_email
       FROM submission_runs sr
       JOIN submissions s ON sr.submission_id = s.id
       JOIN challenges c ON s.challenge_id = c.id
       JOIN users u ON s.user_id = u.id
       ${where}
       ORDER BY sr.started_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows;
  }

  async getJudgeRunDetails(runId: string) {
    const runResult = await query(
      `SELECT sr.id, sr.submission_id, sr.language, sr.status, sr.score_correctness, sr.score_efficiency, sr.score_style,
              sr.test_passed, sr.test_total, sr.runtime_ms, sr.memory_mb, sr.error_message, sr.started_at, sr.finished_at,
              s.user_id, s.challenge_id, s.code, c.title as challenge_title, u.email as user_email
       FROM submission_runs sr
       JOIN submissions s ON sr.submission_id = s.id
       JOIN challenges c ON s.challenge_id = c.id
       JOIN users u ON s.user_id = u.id
       WHERE sr.id = $1`,
      [runId],
    );
    if (runResult.rows.length === 0) throw new Error('Run not found');

    const testsResult = await query(
      `SELECT id, test_case_id, status, runtime_ms, output, error, points_awarded
       FROM submission_run_tests
       WHERE submission_run_id = $1
       ORDER BY id`,
      [runId],
    );

    return {
      ...runResult.rows[0],
      tests: testsResult.rows,
    };
  }

  async retryJudgeRun(runId: string) {
    const result = await query(
      `SELECT sr.id as run_id, s.id as submission_id, s.challenge_id, s.user_id, s.code, s.language, s.session_id
       FROM submission_runs sr
       JOIN submissions s ON sr.submission_id = s.id
       WHERE sr.id = $1`,
      [runId],
    );
    if (result.rows.length === 0) throw new Error('Run not found');

    const row = result.rows[0];
    await query(
      `UPDATE submissions
       SET status = 'pending', judge_status = 'queued', judge_error = NULL
       WHERE id = $1`,
      [row.submission_id],
    );

    await judgeQueue.add(
      'judge.run',
      {
        submissionId: row.submission_id,
        challengeId: row.challenge_id,
        userId: row.user_id,
        code: row.code,
        language: row.language,
        sessionId: row.session_id ?? null,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );

    return { queued: true, submission_id: row.submission_id };
  }

  async getJudgeHealth() {
    const queueCounts = await judgeQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
    return {
      redis_url_configured: Boolean(config.REDIS_URL),
      queue: queueCounts,
    };
  }

  async listUsers() {
    return userService.listUsers();
  }

  async updateUserRole(
    adminUserId: string,
    targetUserId: string,
    role: 'developer' | 'recruiter' | 'admin',
  ) {
    return userService.updateUserRole(adminUserId, targetUserId, role);
  }

  async listRecentProctoringSessions(limit: number, userId?: string, challengeId?: string) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (userId) {
      params.push(userId);
      clauses.push(`ps.user_id = $${params.length}`);
    }
    if (challengeId) {
      params.push(challengeId);
      clauses.push(`ps.challenge_id = $${params.length}`);
    }
    params.push(limit);

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT ps.id, ps.user_id, ps.challenge_id, ps.submission_id, ps.start_time, ps.end_time, ps.status,
              ps.total_violations, ps.total_penalty, ps.pause_count, ps.total_paused_seconds, ps.pause_reason,
              u.name as user_name, u.email as user_email, c.title as challenge_title
       FROM proctoring_sessions ps
       LEFT JOIN users u ON ps.user_id = u.id
       LEFT JOIN challenges c ON ps.challenge_id = c.id
       ${where}
       ORDER BY ps.start_time DESC
       LIMIT $${params.length}`,
      params,
    );
    return result.rows;
  }

  async getProctoringSummary(startDate?: string, endDate?: string) {
    return proctoringService.getViolationSummary(startDate, endDate);
  }

  async getProctoringSessionDetails(sessionId: string) {
    return proctoringService.getSessionDetails(
      sessionId,
      '00000000-0000-0000-0000-000000000000',
      true,
    );
  }

  async getProctoringSettings() {
    return proctoringService.getSettingsForUser('system');
  }

  async updateProctoringSettings(
    adminUserId: string,
    settings: {
      requireCamera?: boolean;
      requireMicrophone?: boolean;
      requireAudio?: boolean;
      strictMode?: boolean;
      allowedViolationsBeforeWarning?: number;
      autoPauseOnViolation?: boolean;
    },
  ) {
    return proctoringService.updateSettingsForUser(adminUserId, settings);
  }

  async getAuditLogs(limit: number) {
    const result = await query(
      `SELECT aal.id, aal.action, aal.details, aal.created_at,
              admin_user.email as admin_email,
              target_user.email as target_email
       FROM admin_audit_logs aal
       LEFT JOIN users admin_user ON aal.admin_user_id = admin_user.id
       LEFT JOIN users target_user ON aal.target_user_id = target_user.id
       ORDER BY aal.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  async listFlaggedWorkExperience(limit: number) {
    const result = await query(
      `SELECT we.id, we.user_id, we.company_name, we.role, we.duration_months,
              we.evidence_links, we.verification_status, we.risk_score, we.added_at,
              u.name as user_name, u.email as user_email
       FROM work_experience we
       JOIN users u ON u.id = we.user_id
       WHERE we.verification_status IN ('flagged', 'rejected')
          OR COALESCE(we.risk_score, 0) > 60
       ORDER BY we.risk_score DESC, we.added_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  }
}

export const adminService = new AdminService();
