const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const PACK_PATH = path.join(__dirname, 'challenge-pack.v2.json');
const REQUIRED_LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'go', 'csharp'];

function loadPack() {
  if (!fs.existsSync(PACK_PATH)) {
    throw new Error(`Challenge pack missing at ${PACK_PATH}. Run: npm run seed:build-pack`);
  }

  const payload = JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'));
  if (!Array.isArray(payload?.challenges)) {
    throw new Error('Invalid challenge pack format: challenges[] required');
  }
  if (payload.challenges.length < 50) {
    throw new Error(`Challenge pack must include at least 50 challenges. Found ${payload.challenges.length}`);
  }
  return payload;
}

async function ensureBaselines(client, challengeId, languages, baseline) {
  const normalizedLanguages =
    Array.isArray(languages) && languages.length > 0 ? languages : REQUIRED_LANGUAGES;

  for (const language of normalizedLanguages) {
    await client.query(
      `INSERT INTO challenge_baselines (challenge_id, language, runtime_ms, memory_mb, lint_rules, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (challenge_id, language) DO UPDATE
       SET runtime_ms = EXCLUDED.runtime_ms,
           memory_mb = EXCLUDED.memory_mb,
           lint_rules = EXCLUDED.lint_rules,
           updated_at = NOW()`,
      [
        challengeId,
        String(language).toLowerCase(),
        Number(baseline?.runtime_ms ?? 2600),
        Number(baseline?.memory_mb ?? 256),
        JSON.stringify(baseline?.lint_rules ?? {}),
      ],
    );
  }
}

async function upsertChallenge(client, challenge) {
  const title = String(challenge.title ?? '').trim();
  const category = String(challenge.category ?? '').trim();
  if (!title || !category) {
    throw new Error('Challenge title and category are required');
  }

  const tests = Array.isArray(challenge.tests) ? challenge.tests : [];
  if (tests.length < 6) {
    throw new Error(`Challenge "${title}" must include at least 6 tests`);
  }

  const existing = await client.query(
    `SELECT id FROM challenges WHERE title = $1 AND category = $2 LIMIT 1`,
    [title, category],
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
      [
        challengeId,
        String(challenge.description ?? ''),
        String(challenge.difficulty ?? 'medium').toLowerCase(),
        String(challenge.seniority ?? 'junior').toLowerCase(),
        Number(challenge.duration ?? 45),
      ],
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO challenges
         (title, description, category, difficulty, target_seniority, duration_minutes, publish_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'published')
       RETURNING id`,
      [
        title,
        String(challenge.description ?? ''),
        category,
        String(challenge.difficulty ?? 'medium').toLowerCase(),
        String(challenge.seniority ?? 'junior').toLowerCase(),
        Number(challenge.duration ?? 45),
      ],
    );
    challengeId = inserted.rows[0].id;
  }

  await client.query(`DELETE FROM challenge_test_cases WHERE challenge_id = $1`, [challengeId]);

  for (let i = 0; i < tests.length; i += 1) {
    const test = tests[i];
    await client.query(
      `INSERT INTO challenge_test_cases
         (challenge_id, name, input, expected_output, is_hidden, points, timeout_ms, memory_mb, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        challengeId,
        String(test.name ?? `case-${i + 1}`),
        String(test.input ?? ''),
        String(test.output ?? ''),
        test.is_hidden !== false,
        Math.max(1, Number(test.points ?? 1)),
        Math.max(1000, Number(test.timeout_ms ?? 5000)),
        Math.max(64, Number(test.memory_mb ?? 256)),
        i,
      ],
    );
  }

  await ensureBaselines(
    client,
    challengeId,
    challenge.supported_languages,
    challenge.baseline,
  );

  return challengeId;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pack = loadPack();
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

    for (const challenge of pack.challenges) {
      const id = await upsertChallenge(client, challenge);
      seeded.push(id);
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
      [REQUIRED_LANGUAGES],
    );

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          success: true,
          pack_version: pack.version ?? 'unknown',
          seeded_count: seeded.length,
          demoted_unready_published: Number(demotedResult.rowCount ?? 0),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to seed challenge pack: ${message}`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
