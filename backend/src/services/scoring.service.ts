import { query } from '../db';
import { getViolationPenalty } from '../constants/violationPenalties';

const SKILL_MAX = 70;
const BEHAVIOR_MAX = 30;
const WORK_EXPERIENCE_MAX = 20;
const TOTAL_MAX = 100;
const SCORING_VERSION = 'v2.0';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeSkillScore(code: string): number {
  if (!code || typeof code !== 'string') return 0;
  const trimmed = code.trim();
  if (!trimmed.length) return 0;

  const placeholderPattern =
    /write your solution here|write your code here|todo|implement me|placeholder/i;
  if (placeholderPattern.test(trimmed) && trimmed.split(/\n/).length <= 6) {
    return 8;
  }

  const hasFunctionLike =
    /\bfunction\b|=>|\bdef\b|\bclass\b|\bpublic\s+static\b|\bprivate\s+\w+\s+\w+\s*\(/i.test(
      trimmed,
    );
  const hasReturn = /\breturn\b/i.test(trimmed);
  const hasBranching = /\bif\b|\belse\b|\bswitch\b|\bcase\b|\bmatch\b|\btry\b|\bcatch\b/i.test(
    trimmed,
  );
  const hasLoop = /\bfor\b|\bwhile\b|\bforeach\b|\bmap\s*\(/i.test(trimmed);
  const hasDataStructure =
    /\barray\b|\blist\b|\bdict\b|\bmap\b|\bset\b|\bvector\b|\bobject\b|\bhash\b/i.test(
      trimmed,
    );
  const hasErrorHandling = /\btry\b|\bcatch\b|\bexcept\b|\bfinally\b/i.test(trimmed);

  const lines = trimmed.split(/\n/).filter((line) => line.trim().length > 0);
  const lineCount = lines.length;
  const avgLineLength =
    lines.reduce((sum, line) => sum + line.length, 0) / Math.max(lines.length, 1);

  let score = 10;
  if (lineCount >= 4) score += 10;
  if (hasFunctionLike) score += 12;
  if (hasReturn) score += 8;
  if (hasBranching) score += 10;
  if (hasLoop) score += 8;
  if (hasDataStructure) score += 6;
  if (hasErrorHandling) score += 4;
  if (lineCount >= 8 && lineCount <= 220) score += 6;
  if (avgLineLength >= 15 && avgLineLength <= 120) score += 6;

  if (lineCount > 350) score -= 8;
  if (avgLineLength > 180) score -= 6;

  return clamp(Math.round(score), 0, SKILL_MAX);
}

interface BehaviorPenaltyBreakdown {
  violationPenalty: number;
  pauseCountPenalty: number;
  pauseDurationPenalty: number;
  heartbeatPenalty: number;
  totalPenalty: number;
  violationCount: number;
}

async function computeBehaviorScore(
  sessionId: string | null,
): Promise<{ score: number; penalties: BehaviorPenaltyBreakdown }> {
  if (!sessionId) {
    return {
      score: BEHAVIOR_MAX,
      penalties: {
        violationPenalty: 0,
        pauseCountPenalty: 0,
        pauseDurationPenalty: 0,
        heartbeatPenalty: 0,
        totalPenalty: 0,
        violationCount: 0,
      },
    };
  }

  const logsResult = await query(
    `SELECT violation_type, penalty FROM proctoring_logs WHERE session_id = $1`,
    [sessionId],
  );

  let violationPenalty = 0;
  for (const row of logsResult.rows) {
    const fallback = getViolationPenalty(String(row.violation_type ?? ''));
    const penalty = Number(row.penalty ?? fallback);
    violationPenalty += Number.isFinite(penalty) ? penalty : fallback;
  }

  let pauseCountPenalty = 0;
  let pauseDurationPenalty = 0;
  let heartbeatPenalty = 0;

  try {
    const sessionResult = await query(
      `SELECT status, pause_count, total_paused_seconds, paused_at, heartbeat_at
       FROM proctoring_sessions
       WHERE id = $1`,
      [sessionId],
    );

    if (sessionResult.rows.length > 0) {
      const row = sessionResult.rows[0];
      const pauseCount = Number(row.pause_count ?? 0);
      let totalPausedSeconds = Number(row.total_paused_seconds ?? 0);

      if (row.status === 'paused' && row.paused_at) {
        const elapsed = Math.floor((Date.now() - new Date(row.paused_at).getTime()) / 1000);
        totalPausedSeconds += Math.max(0, elapsed);
      }

      pauseCountPenalty = Math.min(10, pauseCount * 2);
      pauseDurationPenalty = Math.min(12, Math.floor(totalPausedSeconds / 20));

      if (row.heartbeat_at && row.status === 'active') {
        const heartbeatAgeSeconds =
          (Date.now() - new Date(row.heartbeat_at).getTime()) / 1000;
        if (heartbeatAgeSeconds > 20) {
          heartbeatPenalty = Math.min(
            8,
            Math.floor((heartbeatAgeSeconds - 20) / 10) + 1,
          );
        }
      }
    }
  } catch {
    // Keep behavior scoring resilient even if optional pause columns are not available yet.
  }

  const totalPenalty =
    violationPenalty + pauseCountPenalty + pauseDurationPenalty + heartbeatPenalty;
  const score = clamp(BEHAVIOR_MAX - totalPenalty, 0, BEHAVIOR_MAX);

  return {
    score,
    penalties: {
      violationPenalty,
      pauseCountPenalty,
      pauseDurationPenalty,
      heartbeatPenalty,
      totalPenalty,
      violationCount: logsResult.rows.length,
    },
  };
}

async function computeWorkExperienceScore(userId: string): Promise<number> {
  const result = await query(
    `SELECT COALESCE(SUM(duration_months), 0) as total FROM work_experience WHERE user_id = $1`,
    [userId],
  );
  const totalMonths = Number(result.rows[0]?.total ?? 0);
  return clamp(Math.floor(totalMonths), 0, WORK_EXPERIENCE_MAX);
}

function trustLevelFromScore(total: number): 'Low' | 'Medium' | 'High' {
  if (total >= 80) return 'High';
  if (total >= 55) return 'Medium';
  return 'Low';
}

export interface SubmissionScoreResult {
  score: number;
  trust_level: 'Low' | 'Medium' | 'High';
  components: {
    skill: number;
    challenge: number;
    behavior: number;
    workExperience: number;
  };
  penalties: {
    violations: number;
    pauseCount: number;
    pauseDuration: number;
    heartbeat: number;
    total: number;
    violationCount: number;
  };
  scoring_version: string;
}

export class ScoringService {
  private schemaEnsured = false;

  async ensureScoringSchemaExtensions(): Promise<void> {
    if (this.schemaEnsured) return;

    await query(
      `ALTER TABLE submissions
         ADD COLUMN IF NOT EXISTS component_skill INTEGER,
         ADD COLUMN IF NOT EXISTS component_behavior INTEGER,
         ADD COLUMN IF NOT EXISTS component_work_experience INTEGER,
         ADD COLUMN IF NOT EXISTS component_penalty INTEGER DEFAULT 0,
         ADD COLUMN IF NOT EXISTS scoring_version VARCHAR(20)`,
    );

    this.schemaEnsured = true;
  }

  async computeSubmissionScore(
    userId: string,
    code: string,
    sessionId: string | null,
  ): Promise<SubmissionScoreResult> {
    const skill = computeSkillScore(code);
    const behaviorResult = await computeBehaviorScore(sessionId);
    const workExperience = await computeWorkExperienceScore(userId);

    const submissionScore = clamp(Math.round(skill + behaviorResult.score), 0, TOTAL_MAX);
    const total = clamp(Math.round(submissionScore * 0.8 + workExperience), 0, TOTAL_MAX);
    const trust_level = trustLevelFromScore(total);

    return {
      score: submissionScore,
      trust_level,
      components: {
        skill,
        challenge: skill,
        behavior: behaviorResult.score,
        workExperience,
      },
      penalties: {
        violations: behaviorResult.penalties.violationPenalty,
        pauseCount: behaviorResult.penalties.pauseCountPenalty,
        pauseDuration: behaviorResult.penalties.pauseDurationPenalty,
        heartbeat: behaviorResult.penalties.heartbeatPenalty,
        total: behaviorResult.penalties.totalPenalty,
        violationCount: behaviorResult.penalties.violationCount,
      },
      scoring_version: SCORING_VERSION,
    };
  }

  async recomputeTrustScore(
    userId: string,
  ): Promise<{ total_score: number; trust_level: string }> {
    const [subsResult, workResult] = await Promise.all([
      query(
        `SELECT AVG(score)::numeric as avg_score FROM submissions
         WHERE user_id = $1 AND status = 'graded' AND score IS NOT NULL`,
        [userId],
      ),
      query(
        `SELECT COALESCE(SUM(duration_months), 0) as total FROM work_experience WHERE user_id = $1`,
        [userId],
      ),
    ]);

    const avgSubmission = Number(subsResult.rows[0]?.avg_score ?? 0);
    const workMonths = Number(workResult.rows[0]?.total ?? 0);
    const workScore = clamp(Math.floor(workMonths), 0, WORK_EXPERIENCE_MAX);

    const total = clamp(Math.round(avgSubmission * 0.8 + workScore), 0, TOTAL_MAX);
    const trust_level = trustLevelFromScore(total);

    await query(
      `INSERT INTO trust_scores (user_id, total_score, trust_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET total_score = $2, trust_level = $3, updated_at = NOW()`,
      [userId, total, trust_level],
    );

    return { total_score: total, trust_level };
  }

  async backfillSubmissionScores(
    limit: number = 5000,
  ): Promise<{ processed: number; updated: number; failed: number }> {
    await this.ensureScoringSchemaExtensions();

    const rowsResult = await query(
      `SELECT id, user_id, code, session_id
       FROM submissions
       WHERE status = 'graded'
       ORDER BY submitted_at DESC
       LIMIT $1`,
      [limit],
    );

    let processed = 0;
    let updated = 0;
    let failed = 0;
    const users = new Set<string>();

    for (const row of rowsResult.rows) {
      processed += 1;
      try {
        const result = await this.computeSubmissionScore(
          row.user_id,
          row.code,
          row.session_id ?? null,
        );

        await query(
          `UPDATE submissions
           SET score = $2,
               component_skill = $3,
               component_behavior = $4,
               component_work_experience = $5,
               component_penalty = $6,
               scoring_version = $7
           WHERE id = $1`,
          [
            row.id,
            result.score,
            result.components.skill,
            result.components.behavior,
            result.components.workExperience,
            result.penalties.total,
            result.scoring_version,
          ],
        );
        users.add(row.user_id);
        updated += 1;
      } catch {
        failed += 1;
      }
    }

    await Promise.all([...users].map((userId) => this.recomputeTrustScore(userId)));

    return { processed, updated, failed };
  }
}
