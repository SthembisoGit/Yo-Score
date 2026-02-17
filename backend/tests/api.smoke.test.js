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
const request = require('supertest');

const app = require('../dist/src/app').default;
const pool = require('../dist/db/index').default;

test.after(async () => {
  await pool.end();
});

test('GET /health returns contract envelope', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Service healthy');
  assert.equal(res.body.data.status, 'OK');
});

test('GET / returns API metadata contract', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(typeof res.body.data.version, 'string');
});

test('GET /api/admin/dashboard requires auth', async () => {
  const res = await request(app).get('/api/admin/dashboard');
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.match(String(res.body.message), /token/i);
});

test('unknown route returns not found envelope', async () => {
  const res = await request(app).get('/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.data, null);
});
