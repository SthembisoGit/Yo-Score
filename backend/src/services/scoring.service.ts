import { query } from '../db';

const CHALLENGE_MAX = 60;
const BEHAVIOR_MAX = 20;
const WORK_EXPERIENCE_MAX = 20;
const TOTAL_MAX = 100;

const PENALTIES: Record<string, number> = {
  camera_off: 5,
  tab_switch: 3,
  screen_switch: 3,
  window_blur: 3,
  inactivity: 2,
  multiple_faces: 5,
  no_face: 4,
  looking_away: 3,
  eyes_closed: 2,
  face_covered: 3
};

function computeChallengeScore(code: string): number {
  if (!code || typeof code !== 'string') return 0;
  const trimmed = code.trim();
  if (!trimmed.length) return 0;

  let correctness = 20;
  let efficiency = 10;

  const hasFunction = /\bfunction\b|=>|\(\s*\)\s*=>|async\s+function/.test(trimmed);
  const hasReturn = /\breturn\b/.test(trimmed);
  const hasLogic = /\b(if|else|for|while|switch)\b/.test(trimmed);

  if (hasFunction) correctness += 10;
  if (hasReturn) correctness += 5;
  if (hasLogic) correctness += 5;

  const lines = trimmed.split(/\n/).filter((l) => l.trim().length > 0);
  const avgLineLength = lines.reduce((s, l) => s + l.length, 0) / Math.max(lines.length, 1);
  if (lines.length >= 3 && lines.length <= 50) efficiency += 5;
  if (avgLineLength >= 20 && avgLineLength <= 80) efficiency += 5;

  return Math.min(CHALLENGE_MAX, Math.max(0, correctness + efficiency));
}

async function computeBehaviorScore(sessionId: string | null): Promise<number> {
  if (!sessionId) return BEHAVIOR_MAX;

  const result = await query(
    `SELECT violation_type, penalty FROM proctoring_logs WHERE session_id = $1`,
    [sessionId]
  );

  let totalPenalty = 0;
  for (const row of result.rows) {
    const penalty =
      row.penalty ?? PENALTIES[row.violation_type?.toLowerCase()?.replace(/-/g, '_')] ?? 3;
    totalPenalty += Number(penalty);
  }

  return Math.max(0, BEHAVIOR_MAX - totalPenalty);
}

async function computeWorkExperienceScore(userId: string): Promise<number> {
  const result = await query(
    `SELECT COALESCE(SUM(duration_months), 0) as total FROM work_experience WHERE user_id = $1`,
    [userId]
  );
  const totalMonths = Number(result.rows[0]?.total ?? 0);
  return Math.min(WORK_EXPERIENCE_MAX, Math.floor(totalMonths));
}

function trustLevelFromScore(total: number): 'Low' | 'Medium' | 'High' {
  if (total >= 75) return 'High';
  if (total >= 50) return 'Medium';
  return 'Low';
}

export interface SubmissionScoreResult {
  score: number;
  trust_level: 'Low' | 'Medium' | 'High';
  components: { challenge: number; behavior: number; workExperience: number };
}

export class ScoringService {
  async computeSubmissionScore(
    userId: string,
    code: string,
    sessionId: string | null
  ): Promise<SubmissionScoreResult> {
    const challenge = computeChallengeScore(code);
    const behavior = await computeBehaviorScore(sessionId);
    const workExperience = await computeWorkExperienceScore(userId);

    const submissionScore = Math.min(
      CHALLENGE_MAX + BEHAVIOR_MAX,
      Math.round(challenge + behavior)
    );
    const total = Math.min(TOTAL_MAX, submissionScore + workExperience);
    const trust_level = trustLevelFromScore(total);

    return {
      score: submissionScore,
      trust_level,
      components: { challenge, behavior, workExperience }
    };
  }

  async recomputeTrustScore(userId: string): Promise<{ total_score: number; trust_level: string }> {
    const [subsResult, workResult] = await Promise.all([
      query(
        `SELECT AVG(score)::numeric as avg_score FROM submissions
         WHERE user_id = $1 AND status = 'graded' AND score IS NOT NULL`,
        [userId]
      ),
      query(
        `SELECT COALESCE(SUM(duration_months), 0) as total FROM work_experience WHERE user_id = $1`,
        [userId]
      )
    ]);

    const avgSubmission = Number(subsResult.rows[0]?.avg_score ?? 0);
    const workMonths = Number(workResult.rows[0]?.total ?? 0);
    const workScore = Math.min(WORK_EXPERIENCE_MAX, Math.floor(workMonths));

    const total = Math.min(TOTAL_MAX, Math.max(0, Math.round(avgSubmission) + workScore));
    const trust_level = trustLevelFromScore(total);

    await query(
      `INSERT INTO trust_scores (user_id, total_score, trust_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET total_score = $2, trust_level = $3, updated_at = NOW()`,
      [userId, total, trust_level]
    );

    return { total_score: total, trust_level };
  }
}
