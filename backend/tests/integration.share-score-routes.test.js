process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
process.env.ENABLE_JUDGE = 'false';
process.env.ADMIN_PANEL_ENABLED = 'false';
process.env.STRICT_REAL_SCORING = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../dist/src/app').default;
const pool = require('../dist/src/db/index').default;

const createAccessToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      name: user.name || 'Share User',
      email: user.email || 'share@example.com',
      role: user.role || 'developer',
      token_type: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );

const ensureShareSchema = async () => {
  await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await pool.query(
    `CREATE TABLE IF NOT EXISTS users (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       name VARCHAR(255) NOT NULL,
       email VARCHAR(255) UNIQUE NOT NULL,
       password VARCHAR(255) NOT NULL,
       role VARCHAR(50) DEFAULT 'developer',
       avatar_url TEXT,
       headline VARCHAR(255),
       bio TEXT,
       location VARCHAR(255),
       github_url TEXT,
       linkedin_url TEXT,
       portfolio_url TEXT,
       score_share_enabled BOOLEAN NOT NULL DEFAULT false,
       score_share_token UUID,
       score_share_updated_at TIMESTAMP,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
     )`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS trust_scores (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
       total_score INTEGER DEFAULT 0,
       trust_level VARCHAR(50) DEFAULT 'Low',
       updated_at TIMESTAMP DEFAULT NOW()
     )`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS challenges (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       title VARCHAR(255) NOT NULL,
       description TEXT NOT NULL,
       category VARCHAR(50) NOT NULL,
       difficulty VARCHAR(50) NOT NULL,
       target_seniority VARCHAR(20) NOT NULL DEFAULT 'junior',
       duration_minutes INTEGER NOT NULL DEFAULT 45,
       publish_status VARCHAR(20) NOT NULL DEFAULT 'published',
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
     )`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS submissions (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID REFERENCES users(id) ON DELETE CASCADE,
       challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
       session_id UUID,
       language VARCHAR(20) NOT NULL DEFAULT 'javascript',
       code TEXT NOT NULL,
       score INTEGER,
       judge_status VARCHAR(20) NOT NULL DEFAULT 'queued',
       judge_error TEXT,
       judge_run_id UUID,
       component_correctness INTEGER,
       component_efficiency INTEGER,
       component_style INTEGER,
       component_skill INTEGER,
       component_behavior INTEGER,
       component_work_experience INTEGER,
       component_penalty INTEGER DEFAULT 0,
       scoring_version VARCHAR(20),
       status VARCHAR(50) DEFAULT 'pending',
       submitted_at TIMESTAMP DEFAULT NOW()
     )`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS work_experience (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id UUID REFERENCES users(id) ON DELETE CASCADE,
       company_name VARCHAR(255) NOT NULL,
       role VARCHAR(255) NOT NULL,
       duration_months INTEGER NOT NULL,
       verified BOOLEAN DEFAULT false,
       evidence_links JSONB NOT NULL DEFAULT '[]'::jsonb,
       verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
       risk_score INTEGER NOT NULL DEFAULT 0,
       added_at TIMESTAMP DEFAULT NOW()
     )`,
  );
  await pool.query(
    `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS score_share_enabled BOOLEAN NOT NULL DEFAULT false`,
  );
  await pool.query(
    `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS score_share_token UUID`,
  );
  await pool.query(
    `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS score_share_updated_at TIMESTAMP`,
  );
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_score_share_token_unique
     ON users(score_share_token)
     WHERE score_share_token IS NOT NULL`,
  );
};

const iso = (date) => date.toISOString().replace('T', ' ').replace('Z', '');

const seedShareFixture = async () => {
  const userId = randomUUID();
  const challengeIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const now = new Date();
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10, 10, 0, 0));
  const currentMonthLate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 20, 10, 0, 0));
  const currentMonthLatest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 25, 10, 0, 0));
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 18, 10, 0, 0));

  await pool.query(
    `INSERT INTO users (
       id, name, email, password, role, avatar_url, headline, location,
       github_url, linkedin_url, portfolio_url, score_share_enabled
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)`,
    [
      userId,
      'Share Tester',
      `share-${userId}@example.com`,
      'hashed-password',
      'developer',
      null,
      'Frontend Engineer',
      'Johannesburg',
      'https://github.com/share-tester',
      'https://linkedin.com/in/share-tester',
      'https://share-tester.dev',
    ],
  );

  await pool.query(
    `INSERT INTO trust_scores (user_id, total_score, trust_level, updated_at)
     VALUES ($1, $2, $3, NOW())`,
    [userId, 84, 'High'],
  );

  const challengeValues = [
    [challengeIds[0], 'Array Merge', 'Prompt', 'Frontend', 'easy', 'junior', 45],
    [challengeIds[1], 'API Guard', 'Prompt', 'Backend', 'medium', 'junior', 45],
    [challengeIds[2], 'Auth Audit', 'Prompt', 'Security', 'hard', 'mid', 60],
    [challengeIds[3], 'Queue Retry', 'Prompt', 'DevOps', 'medium', 'mid', 45],
  ];

  for (const row of challengeValues) {
    await pool.query(
      `INSERT INTO challenges (
         id, title, description, category, difficulty, target_seniority, duration_minutes, publish_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'published')`,
      row,
    );
  }

  const submissions = [
    [randomUUID(), challengeIds[0], 'javascript', 78, currentMonth],
    [randomUUID(), challengeIds[1], 'python', 82, currentMonthLate],
    [randomUUID(), challengeIds[2], 'java', 91, currentMonthLatest],
    [randomUUID(), challengeIds[3], 'go', 60, previousMonth],
  ];

  for (const [submissionId, challengeId, language, score, submittedAt] of submissions) {
    await pool.query(
      `INSERT INTO submissions (
         id, user_id, challenge_id, language, code, score, judge_status, status, submitted_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'completed', 'graded', $7::timestamp)`,
      [submissionId, userId, challengeId, language, '// solution', score, iso(submittedAt)],
    );
  }

  return {
    userId,
    challengeIds,
    cleanup: async () => {
      await pool.query('DELETE FROM submissions WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM trust_scores WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM challenges WHERE id = ANY($1::uuid[])', [challengeIds]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    },
  };
};

test.before(async () => {
  await ensureShareSchema();
});

test.after(async () => {
  await pool.end();
});

test('GET /api/users/me/share-score requires authentication', async () => {
  const res = await request(app).get('/api/users/me/share-score');

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('PUT /api/users/me/share-score validates the payload at the boundary', async () => {
  const token = createAccessToken({
    id: '11111111-1111-1111-1111-111111111111',
  });

  const res = await request(app)
    .put('/api/users/me/share-score')
    .set('Authorization', `Bearer ${token}`)
    .send({
      regenerate: true,
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'VALIDATION_FAILED');
});

test('share score lifecycle enables, rotates, and disables a public score link', async () => {
  const fixture = await seedShareFixture();
  const token = createAccessToken({
    id: fixture.userId,
    email: `share-${fixture.userId}@example.com`,
  });

  try {
    const initial = await request(app)
      .get('/api/users/me/share-score')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(initial.status, 200);
    assert.equal(initial.body.data.enabled, false);
    assert.equal(initial.body.data.public_url, null);
    assert.equal(initial.body.data.token_present, false);

    const enabled = await request(app)
      .put('/api/users/me/share-score')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
      });

    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.data.enabled, true);
    assert.equal(enabled.body.data.token_present, true);
    assert.match(enabled.body.data.public_url, /\/share\/[0-9a-f-]{36}$/i);

    const firstToken = enabled.body.data.public_url.split('/').pop();
    const firstPublic = await request(app).get(`/api/public/share-score/${firstToken}`);

    assert.equal(firstPublic.status, 200);
    assert.equal(firstPublic.body.success, true);
    assert.equal(firstPublic.body.data.name, 'Share Tester');
    assert.equal(firstPublic.body.data.email, undefined);
    assert.equal(firstPublic.body.data.total_score, 84);
    assert.equal(firstPublic.body.data.trust_level, 'High');
    assert.equal(firstPublic.body.data.top_recent_results.length, 3);
    assert.deepEqual(
      firstPublic.body.data.top_recent_results.map((row) => row.challenge_title),
      ['Auth Audit', 'API Guard', 'Array Merge'],
    );
    assert.ok(firstPublic.body.data.public_links.github_url);

    const rotated = await request(app)
      .put('/api/users/me/share-score')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: true,
        regenerate: true,
      });

    assert.equal(rotated.status, 200);
    const secondToken = rotated.body.data.public_url.split('/').pop();
    assert.notEqual(secondToken, firstToken);

    const oldLink = await request(app).get(`/api/public/share-score/${firstToken}`);
    assert.equal(oldLink.status, 404);

    const newLink = await request(app).get(`/api/public/share-score/${secondToken}`);
    assert.equal(newLink.status, 200);

    const disabled = await request(app)
      .put('/api/users/me/share-score')
      .set('Authorization', `Bearer ${token}`)
      .send({
        enabled: false,
      });

    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.data.enabled, false);
    assert.equal(disabled.body.data.public_url, null);

    const disabledLink = await request(app).get(`/api/public/share-score/${secondToken}`);
    assert.equal(disabledLink.status, 404);
  } finally {
    await fixture.cleanup();
  }
});
