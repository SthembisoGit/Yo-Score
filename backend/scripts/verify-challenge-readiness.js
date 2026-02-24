const { Pool } = require('pg');
require('dotenv').config();

const REQUIRED_LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'go', 'csharp'];
const MIN_TEST_CASES = 6;
const MIN_TOTAL_POINTS = 10;

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
        `SELECT COUNT(*)::int AS count,
                COALESCE(SUM(points), 0)::int AS total_points,
                COALESCE(SUM(CASE WHEN is_hidden = true THEN 1 ELSE 0 END), 0)::int AS hidden_count
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
      const totalTests = Number(testsResult.rows[0]?.count ?? 0);
      const totalPoints = Number(testsResult.rows[0]?.total_points ?? 0);
      const hiddenCount = Number(testsResult.rows[0]?.hidden_count ?? 0);

      const hasEnoughTests = totalTests >= MIN_TEST_CASES;
      const hasEnoughPoints = totalPoints >= MIN_TOTAL_POINTS;
      const hasHiddenCoverage = hiddenCount >= MIN_TEST_CASES;

      if (!hasEnoughTests || !hasEnoughPoints || !hasHiddenCoverage || missing.length > 0) {
        failures.push({
          challenge_id: challenge.id,
          title: challenge.title,
          total_tests: totalTests,
          total_points: totalPoints,
          hidden_tests: hiddenCount,
          has_enough_tests: hasEnoughTests,
          has_enough_points: hasEnoughPoints,
          has_hidden_coverage: hasHiddenCoverage,
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
          minimum_tests: MIN_TEST_CASES,
          minimum_total_points: MIN_TOTAL_POINTS,
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
