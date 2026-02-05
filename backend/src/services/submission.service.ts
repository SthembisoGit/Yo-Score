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
    const result = await query(
      `SELECT s.id, s.user_id, s.challenge_id, s.code, s.score, s.status, s.submitted_at,
              ts.total_score, ts.trust_level
       FROM submissions s
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

    return {
      submission_id: submission.id,
      score: submission.score,
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
      const { score } = await scoringService.computeSubmissionScore(userId, code, sessionId);

      await query(
        `UPDATE submissions SET score = $1, status = 'graded' WHERE id = $2`,
        [score, submissionId]
      );

      await scoringService.recomputeTrustScore(userId);
    } catch (error) {
      await query(`UPDATE submissions SET status = 'failed' WHERE id = $1`, [submissionId]);
      throw error;
    }
  }
}