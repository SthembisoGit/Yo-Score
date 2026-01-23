import { query } from '../db';

export interface SubmissionInput {
  challenge_id: string;
  code: string;
}

export interface SubmissionResult {
  submission_id: string;
  score: number;
  trust_level: string;
  violations: Array<{
    type: string;
    penalty: number;
    timestamp: Date;
  }>;
}

export class SubmissionService {
  async createSubmission(userId: string, data: SubmissionInput) {
    const result = await query(
      `INSERT INTO submissions (user_id, challenge_id, code, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, user_id, challenge_id, code, status, submitted_at`,
      [userId, data.challenge_id, data.code]
    );

    const submission = result.rows[0];
    
    // Trigger scoring engine (simulated for MVP)
    this.triggerScoring(submission.id);

    return {
      submission_id: submission.id,
      status: submission.status,
      message: 'Submission received'
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

    // Get proctoring logs for this submission
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

  private async triggerScoring(submissionId: string) {
    // Simulate scoring process for MVP
    // In production, this would call a separate scoring service
    
    setTimeout(async () => {
      try {
        // Simulate scoring logic
        const score = Math.floor(Math.random() * 40) + 60; // 60-100
        
        await query(
          `UPDATE submissions 
           SET score = $1, status = 'graded'
           WHERE id = $2`,
          [score, submissionId]
        );

        // Update trust score (simplified)
        const submission = await query(
          `SELECT user_id FROM submissions WHERE id = $1`,
          [submissionId]
        );

        if (submission.rows.length > 0) {
          const userId = submission.rows[0].user_id;
          
          await query(
            `INSERT INTO trust_scores (user_id, total_score, trust_level)
             VALUES ($1, $2, 
               CASE 
                 WHEN $2 >= 75 THEN 'High'
                 WHEN $2 >= 50 THEN 'Medium'
                 ELSE 'Low'
               END)
             ON CONFLICT (user_id) DO UPDATE
             SET total_score = $2,
                 trust_level = CASE 
                   WHEN $2 >= 75 THEN 'High'
                   WHEN $2 >= 50 THEN 'Medium'
                   ELSE 'Low'
                 END,
                 updated_at = NOW()`,
            [userId, score]
          );
        }

      } catch (error) {
        console.error('Scoring failed:', error);
        
        await query(
          `UPDATE submissions SET status = 'failed' WHERE id = $1`,
          [submissionId]
        );
      }
    }, 5000); // Simulate 5-second scoring delay
  }
}