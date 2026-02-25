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
const pool = require('../dist/src/db/index').default;
const { resetMetricsForTests } = require('../dist/src/observability/metrics');

test.after(async () => {
  await pool.end();
});

test.beforeEach(() => {
  resetMetricsForTests();
});

test('GET /metrics returns observability envelope with counters and latency summary', async () => {
  await request(app).get('/health');
  await request(app).get('/health');

  const res = await request(app).get('/metrics').set('x-correlation-id', 'obs-metrics-correlation');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, 'Service metrics');
  assert.equal(typeof res.body.data.requests_total, 'number');
  assert.equal(typeof res.body.data.latency_ms.p50, 'number');
  assert.equal(typeof res.body.data.latency_ms.p95, 'number');
  assert.equal(typeof res.body.data.latency_ms.avg, 'number');
  assert.equal(res.body.meta.correlationId, 'obs-metrics-correlation');
  assert.ok(res.body.data.requests_total >= 2);
});

test('GET /ready returns readiness envelope with dependency checks', async () => {
  const res = await request(app).get('/ready').set('x-correlation-id', 'obs-ready-correlation');

  assert.ok(res.status === 200 || res.status === 503);
  assert.equal(typeof res.body.success, 'boolean');
  assert.equal(typeof res.body.message, 'string');
  assert.equal(typeof res.body.data.database.ok, 'boolean');
  assert.equal(typeof res.body.data.database.latency_ms, 'number');
  assert.equal(typeof res.body.data.ml_service.ok, 'boolean');
  assert.equal(typeof res.body.data.ml_service.latency_ms, 'number');
  assert.equal(res.body.meta.correlationId, 'obs-ready-correlation');
});
