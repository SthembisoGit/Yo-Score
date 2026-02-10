import { query } from '../db';
import { ScoringService } from './scoring.service';

export interface SubmissionInput {
  challenge_id: string;
  code: string;
  session_id?: string;
}

const scoringService = new ScoringService();

export class SubmissionService {
  async createSubmission(userId: string, data: SubmissionInput) {
    if (data.session_id) {
      const sessionResult = await query(
        `SELECT status, pause_reason
         FROM proctoring_sessions
         WHERE id = $1 AND user_id = $2`,
        [data.session_id, userId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid proctoring session');
      }

      const sessionStatus = sessionResult.rows[0].status;
      if (sessionStatus === 'paused') {
        const reason = sessionResult.rows[0].pause_reason || 'Required proctoring checks are not satisfied';
        throw new Error(`Session is paused. ${reason}. Re-enable required devices to continue.`);
      }

      if (sessionStatus === 'completed') {
        throw new Error('Proctoring session already completed');
      }
    }

    const result = await query(
      `INSERT INTO submissions (user_id, challenge_id, code, status, session_id)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING id, user_id, challenge_id, code, status, submitted_at`,
      [userId, data.challenge_id, data.code, data.session_id ?? null]
    );

    const submission = result.rows[0];

    try {
      await query(
        `UPDATE proctoring_logs SET submission_id = $1 WHERE session_id = $2`,
        [submission.id, data.session_id]
      );
    } catch {
      // Logs may not have session_id column or session may have no logs
    }

    await this.scoreSubmission(submission.id, userId, data.code, data.session_id ?? null);

    try {
      await query(
        `UPDATE proctoring_sessions SET submission_id = $1, end_time = NOW(), status = 'completed'
         WHERE id = $2`,
        [submission.id, data.session_id]
      );
    } catch {
      // Session may not exist or table structure may differ
    }

    return {
      submission_id: submission.id,
      status: 'graded',
      message: 'Submission received and scored'
    };
  }

  async getSubmissionById(submissionId: string, userId: string) {
    await scoringService.ensureScoringSchemaExtensions();

    const result = await query(
      `SELECT s.id, s.user_id, s.challenge_id, s.session_id, s.code, s.score, s.status, s.submitted_at,
              s.component_skill, s.component_behavior, s.component_work_experience, s.component_penalty, s.scoring_version,
              c.title AS challenge_title,
              ts.total_score, ts.trust_level
       FROM submissions s
       JOIN challenges c ON s.challenge_id = c.id
       LEFT JOIN trust_scores ts ON s.user_id = ts.user_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [submissionId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Submission not found');
    }

    const submission = result.rows[0];

    const logsResult = await query(
      `SELECT violation_type, penalty, timestamp
       FROM proctoring_logs
       WHERE submission_id = $1
       ORDER BY timestamp`,
      [submissionId]
    );

    const violations = logsResult.rows.map(log => ({
      type: log.violation_type,
      penalty: log.penalty,
      timestamp: log.timestamp
    }));

    const violationPenaltyTotal = violations.reduce(
      (sum, violation) => sum + Number(violation.penalty ?? 0),
      0
    );
    const storedPenalty = Number(submission.component_penalty ?? 0);
    const totalPenalty = Math.max(storedPenalty, violationPenaltyTotal);

    return {
      submission_id: submission.id,
      challenge_id: submission.challenge_id,
      challenge_title: submission.challenge_title,
      status: submission.status,
      submitted_at: submission.submitted_at,
      score: submission.score,
      score_breakdown: {
        components: {
          skill: Number(submission.component_skill ?? 0),
          behavior: Number(submission.component_behavior ?? 0),
          work_experience: Number(submission.component_work_experience ?? 0)
        },
        penalty: totalPenalty,
        scoring_version: submission.scoring_version ?? 'v1.0'
      },
      penalties: {
        total: totalPenalty,
        violation_count: violations.length
      },
      total_score: submission.total_score,
      trust_level: submission.trust_level,
      violations: violations
    };
  }

  async getUserSubmissions(userId: string) {
    const result = await query(
      `SELECT s.id, s.challenge_id, c.title, s.score, s.status, s.submitted_at
       FROM submissions s
       JOIN challenges c ON s.challenge_id = c.id
       WHERE s.user_id = $1
       ORDER BY s.submitted_at DESC`,
      [userId]
    );

    return result.rows.map(sub => ({
      submission_id: sub.id,
      challenge_id: sub.challenge_id,
      challenge_title: sub.title,
      score: sub.score,
      status: sub.status,
      submitted_at: sub.submitted_at
    }));
  }

  private async scoreSubmission(
    submissionId: string,
    userId: string,
    code: string,
    sessionId: string | null
  ) {
    try {
      const result = await scoringService.computeSubmissionScore(userId, code, sessionId);
      await scoringService.ensureScoringSchemaExtensions();

      await query(
        `UPDATE submissions
         SET score = $1,
             status = 'graded',
             component_skill = $2,
             component_behavior = $3,
             component_work_experience = $4,
             component_penalty = $5,
             scoring_version = $6
         WHERE id = $7`,
        [
          result.score,
          result.components.skill,
          result.components.behavior,
          result.components.workExperience,
          result.penalties.total,
          result.scoring_version,
          submissionId
        ]
      );

      await scoringService.recomputeTrustScore(userId);
    } catch (error) {
      await query(`UPDATE submissions SET status = 'failed' WHERE id = $1`, [submissionId]);
      throw error;
    }
  }
}
