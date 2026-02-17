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
    const missingJudge = await client.query(
      `SELECT COUNT(*)::int as count
       FROM submissions
       WHERE status = 'graded'
         AND (judge_status <> 'completed' OR judge_run_id IS NULL)`,
    );

    const users = await client.query(`SELECT DISTINCT user_id FROM submissions`);
    let trustMismatches = 0;

    for (const row of users.rows) {
      const userId = row.user_id;
      const [avgResult, workResult, trustResult] = await Promise.all([
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
        client.query(
          `SELECT total_score
           FROM trust_scores
           WHERE user_id = $1`,
          [userId],
        ),
      ]);

      const avgScore = Number(avgResult.rows[0]?.avg_score ?? 0);
      const workScore = clamp(Math.floor(Number(workResult.rows[0]?.total ?? 0)), 0, 20);
      const expected = clamp(Math.round(avgScore * 0.8 + workScore), 0, 100);
      const actual = Number(trustResult.rows[0]?.total_score ?? 0);

      if (expected !== actual) trustMismatches += 1;
    }

    const result = {
      graded_submissions_missing_judge_completion: missingJudge.rows[0].count,
      users_with_trust_score_mismatch: trustMismatches,
    };
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Consistency check failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
