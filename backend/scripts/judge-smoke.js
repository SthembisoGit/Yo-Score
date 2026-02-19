require('dotenv').config();

const db = require('../dist/db/index.js');
const { query } = db;
const pool = db.default;
const { judgeService } = require('../dist/src/services/judge.service.js');
const { judgeQueue } = require('../dist/src/queue/judgeQueue.js');

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

async function run() {
  try {
    const queueCounts = await withTimeout(
      judgeQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'paused'),
      10000,
      'Queue health',
    );

    const challengeRes = await withTimeout(
      query(
        `SELECT c.id, c.title
         FROM challenges c
         WHERE c.publish_status = 'published'
           AND EXISTS (SELECT 1 FROM challenge_test_cases t WHERE t.challenge_id = c.id)
           AND EXISTS (
             SELECT 1 FROM challenge_baselines b
             WHERE b.challenge_id = c.id AND b.language = 'javascript'
           )
         ORDER BY c.created_at DESC
         LIMIT 1`,
      ),
      10000,
      'Challenge lookup',
    );
    if (!challengeRes.rows.length) {
      throw new Error('No published JavaScript judge-ready challenge found.');
    }

    const challenge = challengeRes.rows[0];
    const code =
      "const fs=require('fs'); const raw=fs.readFileSync(0,'utf8').trim(); console.log(raw || '');";

    const startedAt = Date.now();
    const result = await withTimeout(
      judgeService.runTests(challenge.id, 'javascript', code),
      30000,
      'judgeService.runTests',
    );
    const elapsedMs = Date.now() - startedAt;

    if (!result) {
      throw new Error('Judge returned null run result. Check tests/baseline configuration.');
    }
    if (!Array.isArray(result.tests) || result.tests.length === 0) {
      throw new Error('Judge returned no per-test results.');
    }

    console.log(
      JSON.stringify(
        {
          challenge: challenge.title,
          elapsed_ms: elapsedMs,
          queue: queueCounts,
          summary: result.summary,
          infrastructure_error: result.infrastructureError,
          tests_preview: result.tests.slice(0, 3),
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('JUDGE_SMOKE_ERROR', error?.message ?? error);
    process.exit(1);
  });
