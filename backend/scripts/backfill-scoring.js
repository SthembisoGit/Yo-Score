const { Pool } = require('pg');
require('dotenv').config();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost')
      ? undefined
      : { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const subs = await client.query(
      `SELECT id, user_id, component_correctness, component_efficiency, component_style, component_penalty
       FROM submissions
       WHERE status = 'graded'`,
    );

    const touchedUsers = new Set();

    for (const row of subs.rows) {
      const correctness = Number(row.component_correctness ?? 0);
      const efficiency = Number(row.component_efficiency ?? 0);
      const style = Number(row.component_style ?? 0);
      const penalty = Number(row.component_penalty ?? 0);

      const challenge = clamp(correctness + efficiency + style, 0, 60);
      const behavior = clamp(20 - penalty, 0, 20);
      const score = clamp(Math.round(challenge + behavior), 0, 80);

      await client.query(
        `UPDATE submissions
         SET score = $2,
             component_skill = $3,
             component_behavior = $4,
             scoring_version = 'v3.0',
             judge_status = 'completed'
         WHERE id = $1`,
        [row.id, score, challenge, behavior],
      );

      touchedUsers.add(row.user_id);
    }

    for (const userId of touchedUsers) {
      const [avgResult, workResult] = await Promise.all([
        client.query(
          `SELECT AVG(score)::numeric as avg_score
           FROM submissions
           WHERE user_id = $1 AND status = 'graded' AND score IS NOT NULL`,
          [userId],
        ),
        client.query(
          `SELECT COALESCE(SUM(duration_months), 0) as total
           FROM work_experience
           WHERE user_id = $1`,
          [userId],
        ),
      ]);

      const avgScore = Number(avgResult.rows[0]?.avg_score ?? 0);
      const workScore = clamp(Math.floor(Number(workResult.rows[0]?.total ?? 0)), 0, 20);
      const total = clamp(Math.round(avgScore * 0.8 + workScore), 0, 100);
      const trustLevel = total >= 80 ? 'High' : total >= 55 ? 'Medium' : 'Low';

      await client.query(
        `INSERT INTO trust_scores (user_id, total_score, trust_level)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET total_score = $2, trust_level = $3, updated_at = NOW()`,
        [userId, total, trustLevel],
      );
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          processed_submissions: subs.rows.length,
          recomputed_users: touchedUsers.size,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Backfill failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
