import { query } from '../db';
import { getViolationPenalty } from '../constants/violationPenalties';

const CHALLENGE_MAX = 60;
const BEHAVIOR_MAX = 20;
const WORK_EXPERIENCE_MAX = 20;
const TOTAL_MAX = 100;
const SCORING_VERSION = 'v3.0';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function trustLevelFromScore(total: number): 'Low' | 'Medium' | 'High' {
  if (total >= 80) return 'High';
  if (total >= 55) return 'Medium';
  return 'Low';
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

      pauseCountPenalty = Math.min(8, pauseCount * 2);
      pauseDurationPenalty = Math.min(8, Math.floor(totalPausedSeconds / 30));

      if (row.heartbeat_at && row.status === 'active') {
        const heartbeatAgeSeconds = (Date.now() - new Date(row.heartbeat_at).getTime()) / 1000;
        if (heartbeatAgeSeconds > 20) {
          heartbeatPenalty = Math.min(6, Math.floor((heartbeatAgeSeconds - 20) / 10) + 1);
        }
      }
    }
  } catch {
    // Keep behavior scoring resilient if pause columns are unavailable.
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
  let totalMonths = 0;
  try {
    const result = await query(
      `SELECT COALESCE(SUM(duration_months), 0) as total
       FROM work_experience
       WHERE user_id = $1
         AND verification_status IN ('pending', 'verified')
         AND COALESCE(risk_score, 0) <= 60`,
      [userId],
    );
    totalMonths = Number(result.rows[0]?.total ?? 0);
  } catch {
    const fallback = await query(
      `SELECT COALESCE(SUM(duration_months), 0) as total
       FROM work_experience
       WHERE user_id = $1`,
      [userId],
    );
    totalMonths = Number(fallback.rows[0]?.total ?? 0);
  }
  return clamp(Math.floor(totalMonths), 0, WORK_EXPERIENCE_MAX);
}

export interface SubmissionScoreResult {
  submissionScore: number;
  trustScore: number;
  trustLevel: 'Low' | 'Medium' | 'High';
  components: {
    correctness: number;
    efficiency: number;
    style: number;
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
  scoringVersion: string;
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

  computeSubmissionScoreFromComponents(args: {
    correctness: number;
    efficiency: number;
    style: number;
    behavior: number;
    workExperience: number;
  }): { submissionScore: number; trustScore: number; trustLevel: 'Low' | 'Medium' | 'High' } {
    const correctness = clamp(args.correctness, 0, 40);
    const efficiency = clamp(args.efficiency, 0, 15);
    const style = clamp(args.style, 0, 5);
    const challenge = clamp(correctness + efficiency + style, 0, CHALLENGE_MAX);
    const behavior = clamp(args.behavior, 0, BEHAVIOR_MAX);
    const workExperience = clamp(args.workExperience, 0, WORK_EXPERIENCE_MAX);

    const submissionScore = clamp(Math.round(challenge + behavior), 0, 80);
    const trustScore = clamp(Math.round(submissionScore * 0.8 + workExperience), 0, TOTAL_MAX);
    const trustLevel = trustLevelFromScore(trustScore);
    return { submissionScore, trustScore, trustLevel };
  }

  async finalizeSubmissionScore(
    submissionId: string,
    userId: string,
    sessionId: string | null,
    components: { correctness: number; efficiency: number; style: number },
  ): Promise<SubmissionScoreResult> {
    await this.ensureScoringSchemaExtensions();

    const behaviorResult = await computeBehaviorScore(sessionId);
    const workExperience = await computeWorkExperienceScore(userId);

    const normalized = {
      correctness: clamp(components.correctness, 0, 40),
      efficiency: clamp(components.efficiency, 0, 15),
      style: clamp(components.style, 0, 5),
    };

    const challenge = clamp(
      normalized.correctness + normalized.efficiency + normalized.style,
      0,
      CHALLENGE_MAX,
    );

    const { submissionScore, trustScore, trustLevel } = this.computeSubmissionScoreFromComponents({
      correctness: normalized.correctness,
      efficiency: normalized.efficiency,
      style: normalized.style,
      behavior: behaviorResult.score,
      workExperience,
    });

    await query(
      `UPDATE submissions
       SET score = $2,
           status = 'graded',
           judge_status = 'completed',
           component_correctness = $3,
           component_efficiency = $4,
           component_style = $5,
           component_skill = $6,
           component_behavior = $7,
           component_work_experience = $8,
           component_penalty = $9,
           scoring_version = $10,
           judge_error = NULL
       WHERE id = $1`,
      [
        submissionId,
        submissionScore,
        normalized.correctness,
        normalized.efficiency,
        normalized.style,
        challenge,
        behaviorResult.score,
        workExperience,
        behaviorResult.penalties.totalPenalty,
        SCORING_VERSION,
      ],
    );

    await this.recomputeTrustScore(userId);

    return {
      submissionScore,
      trustScore,
      trustLevel,
      components: {
        correctness: normalized.correctness,
        efficiency: normalized.efficiency,
        style: normalized.style,
        challenge,
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
      scoringVersion: SCORING_VERSION,
    };
  }

  async recomputeTrustScore(
    userId: string,
  ): Promise<{ total_score: number; trust_level: string }> {
    const subsResultPromise = query(
      `SELECT AVG(score)::numeric as avg_score
       FROM submissions
       WHERE user_id = $1 AND status = 'graded' AND score IS NOT NULL`,
      [userId],
    );

    const workResultPromise = (async () => {
      try {
        return await query(
          `SELECT COALESCE(SUM(duration_months), 0) as total
           FROM work_experience
           WHERE user_id = $1
             AND verification_status IN ('pending', 'verified')
             AND COALESCE(risk_score, 0) <= 60`,
          [userId],
        );
      } catch {
        return query(
          `SELECT COALESCE(SUM(duration_months), 0) as total
           FROM work_experience
           WHERE user_id = $1`,
          [userId],
        );
      }
    })();

    const [subsResult, workResult] = await Promise.all([subsResultPromise, workResultPromise]);

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
      `SELECT id, user_id, session_id, component_correctness, component_efficiency, component_style
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
        const correctness = Number(row.component_correctness ?? 0);
        const efficiency = Number(row.component_efficiency ?? 0);
        const style = Number(row.component_style ?? 0);
        await this.finalizeSubmissionScore(row.id, row.user_id, row.session_id ?? null, {
          correctness,
          efficiency,
          style,
        });
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

export const scoringService = new ScoringService();
