import { query } from '../db';
import { getSeniorityBandFromMonths } from '../utils/seniority';

interface MonthlyProgressInput {
  currentMonthAvg: number | null;
  previousMonthAvg: number | null;
  currentMonthCount: number;
  previousMonthCount: number;
}

const MONTHLY_PROGRESS_MIN = -100;
const MONTHLY_PROGRESS_MAX = 100;

function clampMonthlyProgress(value: number): number {
  return Math.max(MONTHLY_PROGRESS_MIN, Math.min(MONTHLY_PROGRESS_MAX, value));
}

function toUtcTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function getUtcMonthWindow(referenceDate: Date = new Date()): {
  previousMonthStartUtc: string;
  currentMonthStartUtc: string;
  nextMonthStartUtc: string;
} {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();

  const previousMonthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const currentMonthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

  return {
    previousMonthStartUtc: toUtcTimestamp(previousMonthStart),
    currentMonthStartUtc: toUtcTimestamp(currentMonthStart),
    nextMonthStartUtc: toUtcTimestamp(nextMonthStart),
  };
}

export function computeMonthlyProgress(input: MonthlyProgressInput): number {
  const currentMonthAvg =
    input.currentMonthAvg !== null && Number.isFinite(input.currentMonthAvg)
      ? input.currentMonthAvg
      : null;
  const previousMonthAvg =
    input.previousMonthAvg !== null && Number.isFinite(input.previousMonthAvg)
      ? input.previousMonthAvg
      : null;
  const hasCurrentMonthData = input.currentMonthCount > 0 && currentMonthAvg !== null;
  const hasPreviousMonthData = input.previousMonthCount > 0 && previousMonthAvg !== null;

  if (!hasCurrentMonthData && !hasPreviousMonthData) {
    return 0;
  }

  if (hasCurrentMonthData && !hasPreviousMonthData) {
    return clampMonthlyProgress(Math.round(currentMonthAvg));
  }

  if (!hasCurrentMonthData && hasPreviousMonthData) {
    return clampMonthlyProgress(-Math.round(previousMonthAvg));
  }

  const current = currentMonthAvg ?? 0;
  const previous = previousMonthAvg ?? 0;
  return clampMonthlyProgress(Math.round(current - previous));
}

export interface DashboardData {
  total_score: number;
  trust_level: string;
  monthly_progress: number;
  seniority_band: 'graduate' | 'junior' | 'mid' | 'senior';
  work_experience_score: number;
  work_experience_summary: {
    trusted_months: number;
    total_entries: number;
    flagged_entries: number;
  };
  category_scores: {
    frontend: number;
    backend: number;
    security: number;
    [key: string]: number;
  };
  challenge_progress: Array<{
    challenge_id: string;
    status: string;
    score: number | null;
  }>;
  stats: {
    total_submissions: number;
    graded_submissions: number;
    pending_submissions: number;
  };
}

export class DashboardService {
  private async getWorkSummary(userId: string) {
    try {
      return await query(
        `SELECT
           COALESCE(SUM(CASE
             WHEN verification_status IN ('pending', 'verified') AND COALESCE(risk_score, 0) <= 60
             THEN duration_months
             ELSE 0
           END), 0) AS trusted_months,
           COUNT(*)::int AS total_entries,
           COUNT(CASE WHEN verification_status = 'flagged' OR verification_status = 'rejected' THEN 1 END)::int AS flagged_entries
         FROM work_experience
         WHERE user_id = $1`,
        [userId],
      );
    } catch {
      return query(
        `SELECT COALESCE(SUM(duration_months), 0) AS trusted_months,
                COUNT(*)::int AS total_entries,
                0::int AS flagged_entries
         FROM work_experience
         WHERE user_id = $1`,
        [userId],
      );
    }
  }

  async getUserDashboard(userId: string): Promise<DashboardData> {
    const { previousMonthStartUtc, currentMonthStartUtc, nextMonthStartUtc } = getUtcMonthWindow();

    const trustResult = await query(
      `SELECT total_score, trust_level 
       FROM trust_scores 
       WHERE user_id = $1`,
      [userId],
    );

    const trustScore = trustResult.rows[0] || { total_score: 0, trust_level: 'Low' };

    const categoryResult = await query(
      `SELECT c.category, AVG(s.score) as avg_score
       FROM submissions s
       JOIN challenges c ON s.challenge_id = c.id
       WHERE s.user_id = $1 AND s.status = 'graded' AND s.score IS NOT NULL
       GROUP BY c.category`,
      [userId],
    );

    const categoryScores: DashboardData['category_scores'] = {
      frontend: 0,
      backend: 0,
      security: 0,
    };

    categoryResult.rows.forEach((row) => {
      categoryScores[row.category] = Math.round(row.avg_score || 0);
    });

    const progressResult = await query(
      `SELECT c.id as challenge_id, 
              c.title,
              s.status,
              s.score,
              s.submitted_at
       FROM challenges c
       LEFT JOIN submissions s ON c.id = s.challenge_id AND s.user_id = $1
       ORDER BY s.submitted_at DESC NULLS LAST, c.created_at DESC`,
      [userId],
    );

    const challengeProgress = progressResult.rows.map((row) => {
      const rawStatus = row.status || 'not_started';
      const displayStatus = rawStatus === 'graded' ? 'completed' : rawStatus;
      return {
        challenge_id: row.challenge_id,
        title: row.title,
        status: displayStatus,
        score: row.score,
        submitted_at: row.submitted_at,
      };
    });

    const statsResult = await query(
      `SELECT 
         COUNT(*) as total_submissions,
         COUNT(CASE WHEN status = 'graded' THEN 1 END) as graded_submissions,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_submissions,
         COUNT(
           CASE
             WHEN status = 'graded'
                  AND score IS NOT NULL
                  AND submitted_at >= $2::timestamp
                  AND submitted_at < $3::timestamp
             THEN 1
           END
         ) as current_month_graded_count,
         COUNT(
           CASE
             WHEN status = 'graded'
                  AND score IS NOT NULL
                  AND submitted_at >= $4::timestamp
                  AND submitted_at < $2::timestamp
             THEN 1
           END
         ) as previous_month_graded_count,
         AVG(
           CASE
             WHEN status = 'graded'
                  AND score IS NOT NULL
                  AND submitted_at >= $2::timestamp
                  AND submitted_at < $3::timestamp
             THEN score
             ELSE NULL
           END
         ) as current_month_avg_score,
         AVG(
           CASE
             WHEN status = 'graded'
                  AND score IS NOT NULL
                  AND submitted_at >= $4::timestamp
                  AND submitted_at < $2::timestamp
             THEN score
             ELSE NULL
           END
         ) as previous_month_avg_score
       FROM submissions 
       WHERE user_id = $1`,
      [userId, currentMonthStartUtc, nextMonthStartUtc, previousMonthStartUtc],
    );

    const stats = statsResult.rows[0] || {
      total_submissions: 0,
      graded_submissions: 0,
      pending_submissions: 0,
      current_month_graded_count: 0,
      previous_month_graded_count: 0,
      current_month_avg_score: null,
      previous_month_avg_score: null,
    };

    const currentMonthCount = Number.parseInt(String(stats.current_month_graded_count ?? 0), 10) || 0;
    const previousMonthCount =
      Number.parseInt(String(stats.previous_month_graded_count ?? 0), 10) || 0;
    const rawCurrentMonthAvg =
      stats.current_month_avg_score === null ? null : Number(stats.current_month_avg_score);
    const rawPreviousMonthAvg =
      stats.previous_month_avg_score === null ? null : Number(stats.previous_month_avg_score);
    const currentMonthAvg =
      rawCurrentMonthAvg !== null && Number.isFinite(rawCurrentMonthAvg)
        ? rawCurrentMonthAvg
        : null;
    const previousMonthAvg =
      rawPreviousMonthAvg !== null && Number.isFinite(rawPreviousMonthAvg)
        ? rawPreviousMonthAvg
        : null;

    const monthlyProgress = computeMonthlyProgress({
      currentMonthAvg,
      previousMonthAvg,
      currentMonthCount,
      previousMonthCount,
    });

    const workSummaryResult = await this.getWorkSummary(userId);
    const trustedMonths = Number(workSummaryResult.rows[0]?.trusted_months ?? 0);
    const workExperienceScore = Math.max(0, Math.min(20, Math.floor(trustedMonths)));
    const seniorityBand = getSeniorityBandFromMonths(trustedMonths);

    return {
      total_score: trustScore.total_score,
      trust_level: trustScore.trust_level,
      monthly_progress: monthlyProgress,
      seniority_band: seniorityBand,
      work_experience_score: workExperienceScore,
      work_experience_summary: {
        trusted_months: trustedMonths,
        total_entries: Number(workSummaryResult.rows[0]?.total_entries ?? 0),
        flagged_entries: Number(workSummaryResult.rows[0]?.flagged_entries ?? 0),
      },
      category_scores: categoryScores,
      challenge_progress: challengeProgress,
      stats: {
        total_submissions: parseInt(stats.total_submissions, 10),
        graded_submissions: parseInt(stats.graded_submissions, 10),
        pending_submissions: parseInt(stats.pending_submissions, 10),
      },
    };
  }
}
