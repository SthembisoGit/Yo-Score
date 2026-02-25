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
const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../dist/src/app').default;
const pool = require('../dist/src/db/index').default;

const createAccessToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      name: user.name || 'Test User',
      email: user.email || 'test@example.com',
      role: user.role || 'developer',
      token_type: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );

test.after(async () => {
  await pool.end();
});

test('GET /api/users/me/work-experience requires authentication', async () => {
  const res = await request(app).get('/api/users/me/work-experience');
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'UNAUTHORIZED');
  assert.ok(res.body.meta && typeof res.body.meta.correlationId === 'string');
});

test('POST /api/users/me/work-experience rejects missing required fields at boundary', async () => {
  const token = createAccessToken({
    id: '11111111-1111-1111-1111-111111111111',
  });

  const res = await request(app)
    .post('/api/users/me/work-experience')
    .set('Authorization', `Bearer ${token}`)
    .send({
      company_name: 'Acme',
      duration_months: 12,
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'VALIDATION_FAILED');
  assert.ok(res.body.meta && typeof res.body.meta.correlationId === 'string');
});

test('POST /api/users/me/work-experience enforces field validation rules', async () => {
  const token = createAccessToken({
    id: '11111111-1111-1111-1111-111111111111',
  });

  const res = await request(app)
    .post('/api/users/me/work-experience')
    .set('Authorization', `Bearer ${token}`)
    .send({
      company_name: 'Acme',
      role: 'Engineer',
      duration_months: 0,
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error, 'VALIDATION_FAILED');
});
