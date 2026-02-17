import { query } from '../db';
import { getSeniorityBandFromMonths } from '../utils/seniority';

export interface DashboardData {
  total_score: number;
  trust_level: string;
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
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_submissions
       FROM submissions 
       WHERE user_id = $1`,
      [userId],
    );

    const stats = statsResult.rows[0] || {
      total_submissions: 0,
      graded_submissions: 0,
      pending_submissions: 0,
    };

    const workSummaryResult = await this.getWorkSummary(userId);
    const trustedMonths = Number(workSummaryResult.rows[0]?.trusted_months ?? 0);
    const workExperienceScore = Math.max(0, Math.min(20, Math.floor(trustedMonths)));
    const seniorityBand = getSeniorityBandFromMonths(trustedMonths);

    return {
      total_score: trustScore.total_score,
      trust_level: trustScore.trust_level,
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
