process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
process.env.ENABLE_JUDGE = 'false';
process.env.ADMIN_PANEL_ENABLED = 'false';
process.env.STRICT_REAL_SCORING = 'false';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { spawnSync } = require('node:child_process');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../dist/src/app').default;
const { createApp } = require('../dist/src/app');
const pool = require('../dist/src/db/index').default;
const { getCorsConfig } = require('../dist/src/utils/corsConfig');
const { sanitizeRedirectPath } = require('../dist/src/utils/redirect');
const { logger } = require('../dist/src/utils/logger');
const { config } = require('../dist/src/config/index');
const {
  loginSecurityGuard,
  resetLoginSecurityState,
} = require('../dist/src/middleware/loginSecurity.middleware');
const { createRateLimiter } = require('../dist/src/middleware/rateLimit.middleware');
const { getRefreshCookieOptions } = require('../dist/src/utils/authCookie');

const accessTokenFor = (user) =>
  jwt.sign(
    {
      id: user.id,
      name: user.name || 'User',
      email: user.email || 'user@example.com',
      role: user.role,
      token_type: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );

const refreshTokenFor = (userId) =>
  jwt.sign(
    {
      id: userId,
      token_type: 'refresh',
      token_id: 'refresh-token-id',
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' },
  );

test.after(async () => {
  await pool.end();
});

test('Step 1: CORS allowlist accepts configured origin and blocks unknown origin', async () => {
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL = 'https://yoscore-frontend.onrender.com';
  process.env.CORS_ALLOWED_ORIGINS = 'https://admin.yoscore.com,*.yoscore.com';

  const corsConfig = getCorsConfig();
  await new Promise((resolve, reject) => {
    corsConfig.origin('https://yoscore-frontend.onrender.com', (err, allow) => {
      try {
        assert.equal(err, null);
        assert.equal(allow, true);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });

  await new Promise((resolve, reject) => {
    corsConfig.origin('https://evil.example.com', (err, allow) => {
      try {
        assert.ok(err instanceof Error);
        assert.equal(allow, undefined);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
});

test('Step 1: CORS preflight returns allow-origin for allowed frontend', async () => {
  const res = await request(app)
    .options('/health')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'GET');

  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
});

test('Step 2: redirect sanitizer allows safe paths and blocks external URLs', () => {
  assert.equal(sanitizeRedirectPath('/dashboard?tab=progress'), '/dashboard?tab=progress');
  assert.equal(sanitizeRedirectPath('/challenges#next'), '/challenges#next');
  assert.equal(sanitizeRedirectPath('https://evil.example.com/phish'), '/dashboard');
  assert.equal(sanitizeRedirectPath('//evil.example.com'), '/dashboard');
  assert.equal(sanitizeRedirectPath('javascript:alert(1)'), '/dashboard');
});

test('Step 3: storage policy file enforces private owner-only avatar rules', () => {
  const policyPath = path.join(__dirname, '..', 'db', 'storage_policies.sql');
  const sql = fs.readFileSync(policyPath, 'utf8');
  assert.match(sql, /'avatars',\s*\n\s*false,/);
  assert.match(sql, /split_part\(name,\s*'\/',\s*1\)\s*=\s*auth\.uid\(\)::text/);
  assert.match(sql, /allowed_mime_types/i);
});

test('Step 4: logger redacts bearer tokens and password fields', () => {
  const redactedBearer = logger.redact('Authorization: Bearer my-super-secret-token');
  assert.ok(redactedBearer.includes('[REDACTED]'));
  const redactedPassword = logger.redact('password="strong_password1@"');
  assert.ok(redactedPassword.includes('[REDACTED]'));
  assert.ok(!redactedPassword.includes('strong_password1@'));
});

test('Step 6: protected admin and user-scoped routes enforce server-side authorization', async () => {
  const developerToken = accessTokenFor({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'developer',
  });

  const adminRes = await request(app)
    .post('/api/proctoring/session/11111111-1111-1111-1111-111111111111/review/enqueue')
    .set('Authorization', `Bearer ${developerToken}`);
  assert.equal(adminRes.status, 403);
  assert.equal(adminRes.body.error, 'FORBIDDEN');

  const otherUserRes = await request(app)
    .get('/api/proctoring/user/22222222-2222-2222-2222-222222222222/sessions')
    .set('Authorization', `Bearer ${developerToken}`);
  assert.equal(otherUserRes.status, 403);
  assert.match(otherUserRes.body.message, /own proctoring sessions/i);
});

const runLoginGuardAttempt = async ({ email, ip, statusCode }) => {
  const req = {
    body: { email, password: 'x' },
    headers: {},
    ip,
    method: 'POST',
    baseUrl: '/api/auth',
    path: '/login',
    correlationId: 'login-guard-test-correlation',
  };

  return await new Promise((resolve) => {
    const res = new EventEmitter();
    res.statusCode = 200;
    const headers = {};
    res.setHeader = (name, value) => {
      headers[String(name).toLowerCase()] = String(value);
    };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (payload) => {
      res.payload = payload;
      res.emit('finish');
      resolve({
        blocked: true,
        statusCode: res.statusCode,
        payload,
        headers,
      });
      return res;
    };

    const next = () => {
      res.statusCode = statusCode;
      res.emit('finish');
      resolve({
        blocked: false,
        statusCode: res.statusCode,
        headers,
      });
    };

    loginSecurityGuard(req, res, next);
  });
};

test('Step 7: login guard locks out repeated failures and success resets counters', async () => {
  resetLoginSecurityState();
  const email = 'lockout@example.com';
  const ip = '203.0.113.10';

  for (let i = 0; i < 5; i += 1) {
    const result = await runLoginGuardAttempt({ email, ip, statusCode: 401 });
    assert.equal(result.blocked, false);
  }
  const locked = await runLoginGuardAttempt({ email, ip, statusCode: 401 });
  assert.equal(locked.blocked, true);
  assert.equal(locked.statusCode, 429);
  assert.equal(locked.payload.message, 'Invalid credentials');
  assert.equal(typeof locked.headers['retry-after'], 'string');
  assert.equal(locked.payload.error_details.code, 'INVALID_CREDENTIALS');
  assert.equal(locked.payload.error_response.correlationId, 'login-guard-test-correlation');

  resetLoginSecurityState();
  for (let i = 0; i < 3; i += 1) {
    const fail = await runLoginGuardAttempt({ email, ip, statusCode: 401 });
    assert.equal(fail.blocked, false);
  }
  const success = await runLoginGuardAttempt({ email, ip, statusCode: 200 });
  assert.equal(success.blocked, false);

  for (let i = 0; i < 5; i += 1) {
    const fail = await runLoginGuardAttempt({ email, ip, statusCode: 401 });
    assert.equal(fail.blocked, false);
  }
  const lockedAfterReset = await runLoginGuardAttempt({ email, ip, statusCode: 401 });
  assert.equal(lockedAfterReset.blocked, true);
  assert.equal(lockedAfterReset.statusCode, 429);
  assert.equal(typeof lockedAfterReset.headers['retry-after'], 'string');
});

test('Step 7: generic rate limiter returns structured 429 with retry guidance', async () => {
  const limitedApp = express();
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 1,
    message: 'Too many test requests',
    code: 'TEST_RATE_LIMIT',
    keyPrefix: 'test-limit',
  });

  limitedApp.get('/limited', limiter, (_req, res) => {
    res.status(200).json({ success: true, data: { ok: true } });
  });

  const first = await request(limitedApp).get('/limited').set('x-correlation-id', 'limit-correlation-id');
  assert.equal(first.status, 200);

  const second = await request(limitedApp).get('/limited').set('x-correlation-id', 'limit-correlation-id');
  assert.equal(second.status, 429);
  assert.equal(second.body.error, 'TEST_RATE_LIMIT');
  assert.equal(second.body.error_details.code, 'TEST_RATE_LIMIT');
  assert.equal(typeof second.body.error_response.correlationId, 'string');
  assert.equal(typeof second.headers['retry-after'], 'string');
});

test('Step 9: global error handler returns generic error and correlation id', async () => {
  const res = await request(app).get('/__test/error').set('x-correlation-id', 'sec-test-correlation');
  assert.equal(res.status, 500);
  assert.equal(res.body.message, 'Unexpected server error');
  assert.equal(res.body.error, 'INTERNAL_SERVER_ERROR');
  assert.equal(res.body.correlation_id, 'sec-test-correlation');
  assert.equal(typeof res.headers['x-correlation-id'], 'string');
});

test('Step 10: refresh rotation rejects missing and invalid refresh tokens', async () => {
  const missingToken = await request(app).post('/api/auth/rotate').send({});
  assert.equal(missingToken.status, 401);
  assert.equal(missingToken.body.error, 'MISSING_TOKEN');

  const invalidToken = await request(app)
    .post('/api/auth/rotate')
    .set('Cookie', [`${config.REFRESH_COOKIE_NAME}=not-a-valid-token`])
    .send({});
  assert.equal(invalidToken.status, 401);
  assert.equal(invalidToken.body.error, 'UNAUTHORIZED');
});

test('Step 10: refresh token type cannot be used as access token', async () => {
  const refreshToken = refreshTokenFor('11111111-1111-1111-1111-111111111111');
  const res = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', `Bearer ${refreshToken}`);
  assert.equal(res.status, 401);
});

test('Step 11: refresh cookie flags align with secure defaults', () => {
  const originalEnv = config.NODE_ENV;
  const originalSameSite = config.AUTH_COOKIE_SAME_SITE;
  const originalTtl = config.REFRESH_TOKEN_TTL;

  try {
    config.NODE_ENV = 'production';
    config.AUTH_COOKIE_SAME_SITE = 'strict';
    config.REFRESH_TOKEN_TTL = '7d';
    const options = getRefreshCookieOptions();
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, 'strict');
    assert.equal(options.path, '/api/auth');
    assert.equal(options.maxAge, 7 * 24 * 60 * 60 * 1000);
  } finally {
    config.NODE_ENV = originalEnv;
    config.AUTH_COOKIE_SAME_SITE = originalSameSite;
    config.REFRESH_TOKEN_TTL = originalTtl;
  }
});

test('Step 11: production mode redirects HTTP requests to HTTPS', async () => {
  const originalEnv = config.NODE_ENV;
  try {
    config.NODE_ENV = 'production';
    const productionApp = createApp();
    const res = await request(productionApp)
      .get('/health')
      .set('Host', 'yoscore-backend.onrender.com')
      .set('x-forwarded-proto', 'http');
    assert.equal(res.status, 308);
    assert.equal(res.headers.location, 'https://yoscore-backend.onrender.com/health');
  } finally {
    config.NODE_ENV = originalEnv;
  }
});

test('Step 12: security headers are present on API responses', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(typeof res.headers['content-security-policy'] === 'string');
  assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
  assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.ok(typeof res.headers['permissions-policy'] === 'string');
});

test('Step 13: strict validation rejects unknown fields on auth and code run routes', async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@example.com', password: 'password123', extra: 'nope' });
  assert.equal(loginRes.status, 400);
  assert.equal(loginRes.body.error, 'VALIDATION_FAILED');

  const token = accessTokenFor({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'developer',
  });
  const codeRes = await request(app)
    .post('/api/code/run')
    .set('Authorization', `Bearer ${token}`)
    .send({ language: 'javascript', code: 'console.log(1);', extra: true });
  assert.equal(codeRes.status, 400);
  assert.equal(codeRes.body.error, 'VALIDATION_FAILED');
});

test('Step 14: proctoring upload endpoints reject unsupported audio payloads', async () => {
  const token = accessTokenFor({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'developer',
  });
  const res = await request(app)
    .post('/api/proctoring/analyze-audio?sessionId=11111111-1111-1111-1111-111111111111&timestamp=2026-01-01T00:00:00.000Z')
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/octet-stream')
    .send(Buffer.from('not-real-audio'));

  assert.equal(res.status, 415);
  assert.match(res.body.message, /Unsupported audio format/i);
});

test('Step 14: proctoring upload endpoints enforce size limits', async () => {
  const token = accessTokenFor({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'developer',
  });
  const largePayload = Buffer.alloc(10 * 1024 * 1024 + 1, 0xaa);
  const res = await request(app)
    .post('/api/proctoring/analyze-audio?sessionId=11111111-1111-1111-1111-111111111111&timestamp=2026-01-01T00:00:00.000Z')
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/octet-stream')
    .send(largePayload);

  assert.equal(res.status, 413);
});

test('Step 15: production startup fails fast when refresh secret is missing', () => {
  const result = spawnSync(
    process.execPath,
    ['-e', "require('./dist/src/config/index.js');"],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
        FRONTEND_URL: 'https://yoscore-frontend.onrender.com',
        JWT_SECRET: 'super-strong-access-secret',
        REFRESH_TOKEN_SECRET: '',
      },
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 1);
  assert.match(
    `${result.stderr}${result.stdout}`,
    /REFRESH_TOKEN_SECRET is required in production/i,
  );
});
