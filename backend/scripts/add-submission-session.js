const { Pool } = require('pg');
require('dotenv').config();

async function addSubmissionSession() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'submissions' AND column_name = 'session_id'
    `);

    if (result.rows.length === 0) {
      await client.query(`
        ALTER TABLE submissions
        ADD COLUMN session_id UUID REFERENCES proctoring_sessions(id) ON DELETE SET NULL
      `);
      console.log('Added session_id to submissions');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

addSubmissionSession().catch((err) => {
  console.error(err);
  process.exit(1);
});
