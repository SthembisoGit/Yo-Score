process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
process.env.ENABLE_JUDGE = 'false';
process.env.ADMIN_PANEL_ENABLED = 'false';
process.env.STRICT_REAL_SCORING = 'false';
process.env.PROCTORING_REQUIRE_CONSENT = 'true';
process.env.PROCTORING_PRIVACY_POLICY_VERSION =
  process.env.PROCTORING_PRIVACY_POLICY_VERSION || '2026-02-25';

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
      role: user.role,
      token_type: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );

test.after(async () => {
  await pool.end();
});

test('should_return_401_for_proctoring_status_when_auth_token_is_missing', async () => {
  const response = await request(app).get(
    '/api/proctoring/session/11111111-1111-1111-1111-111111111111/status',
  );

  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'UNAUTHORIZED');
});

test('should_return_proctoring_privacy_notice_for_authenticated_user', async () => {
  const token = createAccessToken({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'developer',
  });

  const response = await request(app)
    .get('/api/proctoring/privacy')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(typeof response.body.data.policy_version, 'string');
  assert.equal(typeof response.body.data.retention_days, 'number');
  assert.ok(Array.isArray(response.body.data.capture_scope));
  assert.equal(typeof response.body.data.snapshot_handling, 'object');
  assert.equal(response.body.data.snapshot_handling.stored_after_processing, false);
  assert.equal(response.body.data.snapshot_handling.deleted_after_processing, true);
  assert.equal(typeof response.body.data.submission_hold_policy, 'object');
  assert.equal(response.body.data.submission_hold_policy.wait_for_snapshot_processing, true);
  assert.equal(typeof response.body.data.submission_hold_policy.max_wait_seconds, 'number');
});

test('should_require_proctoring_privacy_consent_when_starting_session', async () => {
  const token = createAccessToken({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'developer',
  });

  const response = await request(app)
    .post('/api/proctoring/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({
      challengeId: '11111111-1111-1111-1111-111111111111',
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'CONSENT_REQUIRED');
});

test('should_reject_stale_proctoring_privacy_policy_version', async () => {
  const token = createAccessToken({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'developer',
  });

  const response = await request(app)
    .post('/api/proctoring/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({
      challengeId: '11111111-1111-1111-1111-111111111111',
      consent: {
        accepted: true,
        accepted_at: new Date().toISOString(),
        policy_version: '2025-01-01',
      },
    });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'CONSENT_VERSION_MISMATCH');
});

test('should_return_400_when_session_id_param_is_not_uuid', async () => {
  const token = createAccessToken({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'developer',
  });

  const response = await request(app)
    .get('/api/proctoring/session/not-a-uuid/status')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'VALIDATION_FAILED');
});

test('should_return_400_when_user_id_param_is_not_uuid', async () => {
  const token = createAccessToken({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'developer',
  });

  const response = await request(app)
    .get('/api/proctoring/user/not-a-uuid/sessions')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'VALIDATION_FAILED');
});
