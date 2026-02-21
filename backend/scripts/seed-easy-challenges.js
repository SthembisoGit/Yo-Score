const { Pool } = require('pg');
require('dotenv').config();

const ALL_LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'go', 'csharp'];

const CHALLENGES = [
  {
    title: 'Frontend: Sum Two Integers',
    category: 'Frontend',
    difficulty: 'easy',
    seniority: 'graduate',
    duration: 20,
    description:
      'Read two integers from stdin and print their sum.\nInput: two integers separated by space or newline.\nOutput: one integer.',
    tests: [
      { input: '2 3\n', output: '5' },
      { input: '-4 9\n', output: '5' },
      { input: '100 250\n', output: '350' },
    ],
  },
  {
    title: 'Backend: Sum 1 to N',
    category: 'Backend',
    difficulty: 'easy',
    seniority: 'graduate',
    duration: 25,
    description:
      'Read integer n and print sum(1..n).',
    tests: [
      { input: '1\n', output: '1' },
      { input: '5\n', output: '15' },
      { input: '10\n', output: '55' },
    ],
  },
  {
    title: 'Security: Validate Password Strength',
    category: 'Security',
    difficulty: 'medium',
    seniority: 'junior',
    duration: 30,
    description:
      'Read a password string and print STRONG if length >= 8 and it contains upper, lower, digit, and special char. Otherwise print WEAK.',
    tests: [
      { input: 'YoScore@2026\n', output: 'STRONG' },
      { input: 'password\n', output: 'WEAK' },
      { input: 'A1@aaaa\n', output: 'WEAK' },
    ],
  },
  {
    title: 'DevOps: Reverse String',
    category: 'DevOps',
    difficulty: 'easy',
    seniority: 'graduate',
    duration: 20,
    description:
      'Read one line and print it reversed.',
    tests: [
      { input: 'hello\n', output: 'olleh' },
      { input: 'Yo Score\n', output: 'erocS oY' },
      { input: 'abc123\n', output: '321cba' },
    ],
  },
  {
    title: 'Cloud Engineering: FizzBuzz Single',
    category: 'Cloud Engineering',
    difficulty: 'easy',
    seniority: 'graduate',
    duration: 20,
    description:
      'Read integer n and print FizzBuzz/Fizz/Buzz/or n.',
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
    difficulty: 'medium',
    seniority: 'junior',
    duration: 35,
    description:
      'Read n then n integers and print the minimum.',
    tests: [
      { input: '5\n9 3 7 1 8\n', output: '1' },
      { input: '3\n-2 -5 -1\n', output: '-5' },
      { input: '1\n42\n', output: '42' },
    ],
  },
  {
    title: 'Mobile Development: Even or Odd',
    category: 'Mobile Development',
    difficulty: 'easy',
    seniority: 'graduate',
    duration: 15,
    description:
      'Read one integer and print EVEN if even else ODD.',
    tests: [
      { input: '4\n', output: 'EVEN' },
      { input: '9\n', output: 'ODD' },
      { input: '0\n', output: 'EVEN' },
    ],
  },
  {
    title: 'QA Testing: Max of Three Numbers',
    category: 'QA Testing',
    difficulty: 'easy',
    seniority: 'graduate',
    duration: 20,
    description:
      'Read three integers and print the largest.',
    tests: [
      { input: '1 5 3\n', output: '5' },
      { input: '-1 -5 -3\n', output: '-1' },
      { input: '10 10 7\n', output: '10' },
    ],
  },
  {
    title: 'Backend: Frequency Map (AI Fix)',
    category: 'Backend',
    difficulty: 'medium',
    seniority: 'junior',
    duration: 40,
    description:
      'AI-generated code often forgets to trim input and counts spaces incorrectly.\nRead one line and print key:value pairs for letter frequency in alphabetical order (ignore spaces, case-insensitive).',
    tests: [
      { input: 'aA b\n', output: 'a:2,b:1' },
      { input: 'YoScore\n', output: 'c:1,e:1,o:2,r:1,s:1,y:1' },
      { input: 'bbb aaa\n', output: 'a:3,b:3' },
    ],
  },
  {
    title: 'Frontend: Balanced Brackets',
    category: 'Frontend',
    difficulty: 'hard',
    seniority: 'mid',
    duration: 45,
    description:
      'Read a string of brackets ()[]{} and print VALID if balanced else INVALID.',
    tests: [
      { input: '([]){}\n', output: 'VALID' },
      { input: '([)]\n', output: 'INVALID' },
      { input: '((()))\n', output: 'VALID' },
    ],
  },
  {
    title: 'Security: SQL Injection Pattern Scan (AI Fix)',
    category: 'Security',
    difficulty: 'hard',
    seniority: 'mid',
    duration: 45,
    description:
      'Read one line query input and print BLOCK if it contains common injection markers (--, ;--, OR 1=1, UNION SELECT), else ALLOW.',
    tests: [
      { input: "name='john' OR 1=1\n", output: 'BLOCK' },
      { input: 'SELECT * FROM users WHERE id=4\n', output: 'ALLOW' },
      { input: 'UNION SELECT password FROM users\n', output: 'BLOCK' },
    ],
  },
  {
    title: 'Cloud Engineering: Retry Backoff Calculator',
    category: 'Cloud Engineering',
    difficulty: 'hard',
    seniority: 'senior',
    duration: 50,
    description:
      'Read base delay b and retries r. Print exponential backoff sequence b*2^i for i in [0,r-1], comma-separated.',
    tests: [
      { input: '100 4\n', output: '100,200,400,800' },
      { input: '50 1\n', output: '50' },
      { input: '10 3\n', output: '10,20,40' },
    ],
  },
  {
    title: 'DevOps: Parse Log Severity Counts',
    category: 'DevOps',
    difficulty: 'medium',
    seniority: 'junior',
    duration: 35,
    description:
      'Read n then n log lines. Count lines containing INFO, WARN, ERROR and print INFO:x,WARN:y,ERROR:z.',
    tests: [
      { input: '4\nINFO ok\nWARN disk\nERROR fail\nINFO done\n', output: 'INFO:2,WARN:1,ERROR:1' },
      { input: '2\nDEBUG hi\nTRACE no\n', output: 'INFO:0,WARN:0,ERROR:0' },
      { input: '3\nERROR a\nERROR b\nWARN c\n', output: 'INFO:0,WARN:1,ERROR:2' },
    ],
  },
];

async function ensureBaselines(client, challengeId) {
  for (const language of ALL_LANGUAGES) {
    await client.query(
      `INSERT INTO challenge_baselines (challenge_id, language, runtime_ms, memory_mb, lint_rules, updated_at)
       VALUES ($1, $2, 2500, 256, '{}'::jsonb, NOW())
       ON CONFLICT (challenge_id, language) DO UPDATE
       SET runtime_ms = EXCLUDED.runtime_ms,
           memory_mb = EXCLUDED.memory_mb,
           lint_rules = EXCLUDED.lint_rules,
           updated_at = NOW()`,
      [challengeId, language],
    );
  }
}

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
           difficulty = $3,
           target_seniority = $4,
           duration_minutes = $5,
           publish_status = 'published',
           updated_at = NOW()
       WHERE id = $1`,
      [challengeId, spec.description, spec.difficulty, spec.seniority, spec.duration],
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO challenges
         (title, description, category, difficulty, target_seniority, duration_minutes, publish_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'published')
       RETURNING id`,
      [spec.title, spec.description, spec.category, spec.difficulty, spec.seniority, spec.duration],
    );
    challengeId = inserted.rows[0].id;
  }

  await client.query(`DELETE FROM challenge_test_cases WHERE challenge_id = $1`, [challengeId]);

  for (let index = 0; index < spec.tests.length; index += 1) {
    const test = spec.tests[index];
    await client.query(
      `INSERT INTO challenge_test_cases
         (challenge_id, name, input, expected_output, is_hidden, points, timeout_ms, memory_mb, order_index)
       VALUES ($1, $2, $3, $4, true, 1, 5000, 256, $5)`,
      [challengeId, `case-${index + 1}`, test.input, test.output, index],
    );
  }

  await ensureBaselines(client, challengeId);
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

    const seeded = [];
    for (const challenge of CHALLENGES) {
      const id = await upsertChallenge(client, challenge);
      seeded.push({ id, title: challenge.title, category: challenge.category, difficulty: challenge.difficulty });
    }

    const demotedResult = await client.query(
      `UPDATE challenges c
       SET publish_status = 'draft',
           updated_at = NOW()
       WHERE c.publish_status = 'published'
         AND (
           NOT EXISTS (
             SELECT 1
             FROM challenge_test_cases t
             WHERE t.challenge_id = c.id
           )
           OR EXISTS (
             SELECT 1
             FROM unnest($1::text[]) AS required(language)
             WHERE NOT EXISTS (
               SELECT 1
               FROM challenge_baselines b
               WHERE b.challenge_id = c.id
                 AND LOWER(b.language) = required.language
             )
           )
         )`,
      [ALL_LANGUAGES],
    );

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          success: true,
          count: seeded.length,
          languages: ALL_LANGUAGES,
          demoted_unready_published: Number(demotedResult.rowCount ?? 0),
          challenges: seeded,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to seed challenges: ${message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
