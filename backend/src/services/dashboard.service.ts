import { query } from '../db';

export interface DashboardData {
  total_score: number;
  trust_level: string;
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
  async getUserDashboard(userId: string): Promise<DashboardData> {
    // Get trust score
    const trustResult = await query(
      `SELECT total_score, trust_level 
       FROM trust_scores 
       WHERE user_id = $1`,
      [userId]
    );

    const trustScore = trustResult.rows[0] || { total_score: 0, trust_level: 'Low' };

    // Get category scores from submissions
    const categoryResult = await query(
      `SELECT c.category, AVG(s.score) as avg_score
       FROM submissions s
       JOIN challenges c ON s.challenge_id = c.id
       WHERE s.user_id = $1 AND s.status = 'graded' AND s.score IS NOT NULL
       GROUP BY c.category`,
      [userId]
    );

    const categoryScores: DashboardData['category_scores'] = {
      frontend: 0,
      backend: 0,
      security: 0
    };

    categoryResult.rows.forEach(row => {
      categoryScores[row.category] = Math.round(row.avg_score || 0);
    });

    // Get challenge progress
    const progressResult = await query(
      `SELECT c.id as challenge_id, 
              c.title,
              s.status,
              s.score,
              s.submitted_at
       FROM challenges c
       LEFT JOIN submissions s ON c.id = s.challenge_id AND s.user_id = $1
       ORDER BY s.submitted_at DESC NULLS LAST, c.created_at DESC`,
      [userId]
    );

    const challengeProgress = progressResult.rows.map(row => {
      const rawStatus = row.status || 'not_started';
      const displayStatus = rawStatus === 'graded' ? 'completed' : rawStatus;
      return {
        challenge_id: row.challenge_id,
        title: row.title,
        status: displayStatus,
        score: row.score,
        submitted_at: row.submitted_at
      };
    });

    // Calculate total submissions and completed challenges
    const statsResult = await query(
      `SELECT 
         COUNT(*) as total_submissions,
         COUNT(CASE WHEN status = 'graded' THEN 1 END) as graded_submissions,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_submissions
       FROM submissions 
       WHERE user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0] || {
      total_submissions: 0,
      graded_submissions: 0,
      pending_submissions: 0
    };

    return {
      total_score: trustScore.total_score,
      trust_level: trustScore.trust_level,
      category_scores: categoryScores,
      challenge_progress: challengeProgress,
      stats: {
        total_submissions: parseInt(stats.total_submissions),
        graded_submissions: parseInt(stats.graded_submissions),
        pending_submissions: parseInt(stats.pending_submissions)
      }
    };
  }
}