const { Pool } = require('pg');
require('dotenv').config();

const REQUIRED_LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'go', 'csharp'];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
      ? undefined
      : { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    const challengesResult = await client.query(
      `SELECT id, title
       FROM challenges
       WHERE publish_status = 'published'
       ORDER BY created_at DESC`,
    );

    const failures = [];
    for (const challenge of challengesResult.rows) {
      const testsResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM challenge_test_cases
         WHERE challenge_id = $1`,
        [challenge.id],
      );

      const baselineResult = await client.query(
        `SELECT language
         FROM challenge_baselines
         WHERE challenge_id = $1`,
        [challenge.id],
      );

      const languages = baselineResult.rows.map((row) => String(row.language).toLowerCase());
      const missing = REQUIRED_LANGUAGES.filter((language) => !languages.includes(language));
      const hasTests = Number(testsResult.rows[0]?.count ?? 0) > 0;

      if (!hasTests || missing.length > 0) {
        failures.push({
          challenge_id: challenge.id,
          title: challenge.title,
          has_tests: hasTests,
          missing_languages: missing,
        });
      }
    }

    if (failures.length > 0) {
      console.error(
        JSON.stringify(
          {
            success: false,
            message: 'Published challenges missing required readiness configuration',
            failures,
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          success: true,
          published_challenges: challengesResult.rows.length,
          required_languages: REQUIRED_LANGUAGES,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to verify readiness: ${message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
