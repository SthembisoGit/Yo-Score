const { Pool } = require('pg');
require('dotenv').config();

const EASY_CHALLENGES = [
  {
    title: 'Frontend: Sum Two Integers',
    category: 'Frontend',
    description:
      'Read two integers from stdin and print their sum.\nInput: two integers separated by space or newline.\nOutput: a single integer.',
    tests: [
      { input: '2 3\n', output: '5' },
      { input: '-4 9\n', output: '5' },
      { input: '100 250\n', output: '350' },
    ],
  },
  {
    title: 'Backend: Sum 1 to N',
    category: 'Backend',
    description:
      'Read an integer n from stdin and print the sum of numbers from 1 to n.\nInput: one integer n.\nOutput: sum(1..n).',
    tests: [
      { input: '1\n', output: '1' },
      { input: '5\n', output: '15' },
      { input: '10\n', output: '55' },
    ],
  },
  {
    title: 'Security: Count Vowels',
    category: 'Security',
    description:
      'Read a line from stdin and print how many vowels it contains.\nVowels: a, e, i, o, u (case-insensitive).',
    tests: [
      { input: 'hello\n', output: '2' },
      { input: 'YOScore\n', output: '3' },
      { input: 'bcdf\n', output: '0' },
    ],
  },
  {
    title: 'IT Support: Print Exact Name',
    category: 'IT Support',
    description:
      'Ignore any input and print exactly: YoScore\nOutput must match case and spelling.',
    tests: [
      { input: '\n', output: 'YoScore' },
      { input: 'anything\n', output: 'YoScore' },
      { input: '123 456\n', output: 'YoScore' },
    ],
  },
  {
    title: 'DevOps: Reverse String',
    category: 'DevOps',
    description:
      'Read one line from stdin and print it reversed.\nKeep spaces and symbols in the reversed output.',
    tests: [
      { input: 'hello\n', output: 'olleh' },
      { input: 'Yo Score\n', output: 'erocS oY' },
      { input: 'abc123\n', output: '321cba' },
    ],
  },
  {
    title: 'Cloud Engineering: FizzBuzz Single',
    category: 'Cloud Engineering',
    description:
      'Read one integer n and print:\nFizzBuzz if divisible by 3 and 5,\nFizz if divisible by 3,\nBuzz if divisible by 5,\notherwise print n.',
    tests: [
      { input: '3\n', output: 'Fizz' },
      { input: '10\n', output: 'Buzz' },
      { input: '15\n', output: 'FizzBuzz' },
      { input: '7\n', output: '7' },
    ],
  },
  {
    title: 'Data Science: Minimum of N Numbers',
    category: 'Data Science',
    description:
      'Read integer n, then read n integers, and print the minimum value.\nInput can be space-separated or newline-separated.',
    tests: [
      { input: '5\n9 3 7 1 8\n', output: '1' },
      { input: '3\n-2 -5 -1\n', output: '-5' },
      { input: '1\n42\n', output: '42' },
    ],
  },
  {
    title: 'Mobile Development: Even or Odd',
    category: 'Mobile Development',
    description:
      'Read one integer and print EVEN if it is even, otherwise print ODD.',
    tests: [
      { input: '4\n', output: 'EVEN' },
      { input: '9\n', output: 'ODD' },
      { input: '0\n', output: 'EVEN' },
    ],
  },
  {
    title: 'QA Testing: Max of Three Numbers',
    category: 'QA Testing',
    description:
      'Read three integers and print the largest one.',
    tests: [
      { input: '1 5 3\n', output: '5' },
      { input: '-1 -5 -3\n', output: '-1' },
      { input: '10 10 7\n', output: '10' },
    ],
  },
];

async function upsertChallenge(client, spec) {
  const existing = await client.query(
    `SELECT id FROM challenges WHERE title = $1 AND category = $2 LIMIT 1`,
    [spec.title, spec.category],
  );

  let challengeId;
  if (existing.rows.length > 0) {
    challengeId = existing.rows[0].id;
    await client.query(
      `UPDATE challenges
       SET description = $2,
           difficulty = 'easy',
           target_seniority = 'graduate',
           duration_minutes = 20,
           publish_status = 'published',
           updated_at = NOW()
       WHERE id = $1`,
      [challengeId, spec.description],
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO challenges
         (title, description, category, difficulty, target_seniority, duration_minutes, publish_status)
       VALUES ($1, $2, $3, 'easy', 'graduate', 20, 'published')
       RETURNING id`,
      [spec.title, spec.description, spec.category],
    );
    challengeId = inserted.rows[0].id;
  }

  await client.query(`DELETE FROM challenge_test_cases WHERE challenge_id = $1`, [challengeId]);

  for (let index = 0; index < spec.tests.length; index += 1) {
    const test = spec.tests[index];
    await client.query(
      `INSERT INTO challenge_test_cases
         (challenge_id, name, input, expected_output, is_hidden, points, timeout_ms, memory_mb, order_index)
       VALUES ($1, $2, $3, $4, false, 1, 4000, 256, $5)`,
      [challengeId, `case-${index + 1}`, test.input, test.output, index],
    );
  }

  await client.query(
    `INSERT INTO challenge_baselines (challenge_id, language, runtime_ms, memory_mb, lint_rules, updated_at)
     VALUES ($1, 'javascript', 1200, 256, '{}'::jsonb, NOW())
     ON CONFLICT (challenge_id, language) DO UPDATE
     SET runtime_ms = EXCLUDED.runtime_ms,
         memory_mb = EXCLUDED.memory_mb,
         lint_rules = EXCLUDED.lint_rules,
         updated_at = NOW()`,
    [challengeId],
  );

  await client.query(
    `INSERT INTO challenge_baselines (challenge_id, language, runtime_ms, memory_mb, lint_rules, updated_at)
     VALUES ($1, 'python', 1400, 256, '{}'::jsonb, NOW())
     ON CONFLICT (challenge_id, language) DO UPDATE
     SET runtime_ms = EXCLUDED.runtime_ms,
         memory_mb = EXCLUDED.memory_mb,
         lint_rules = EXCLUDED.lint_rules,
         updated_at = NOW()`,
    [challengeId],
  );

  return challengeId;
}

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
    await client.query('BEGIN');

    const createdOrUpdated = [];
    for (const challenge of EASY_CHALLENGES) {
      const id = await upsertChallenge(client, challenge);
      createdOrUpdated.push({ id, title: challenge.title, category: challenge.category });
    }

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          success: true,
          count: createdOrUpdated.length,
          challenges: createdOrUpdated,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to seed easy challenges: ${message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
