process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
process.env.REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '7d';
process.env.ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
process.env.BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || '4';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { AuthService } = require('../dist/src/services/auth.service');
const { authRepository } = require('../dist/src/repositories/auth.repository');

const originalRepositoryMethods = {
  ensureRefreshTokenSchema: authRepository.ensureRefreshTokenSchema,
  findUserIdByEmail: authRepository.findUserIdByEmail,
  createUser: authRepository.createUser,
  findUserForLoginByEmail: authRepository.findUserForLoginByEmail,
  findUserById: authRepository.findUserById,
  insertRefreshToken: authRepository.insertRefreshToken,
  findRefreshTokenByHash: authRepository.findRefreshTokenByHash,
  revokeRefreshTokenByHash: authRepository.revokeRefreshTokenByHash,
  revokeActiveRefreshTokensByUserId: authRepository.revokeActiveRefreshTokensByUserId,
  markRefreshTokenRotated: authRepository.markRefreshTokenRotated,
};

const restoreRepositoryMethods = () => {
  Object.assign(authRepository, originalRepositoryMethods);
};

test.afterEach(() => {
  restoreRepositoryMethods();
});

test('should_issue_access_and_refresh_tokens_when_login_credentials_are_valid', async () => {
  const passwordHash = await bcrypt.hash('Passw0rd!', 4);
  const insertCalls = [];

  authRepository.findUserForLoginByEmail = async () => ({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Test User',
    email: 'test@example.com',
    password: passwordHash,
    role: 'developer',
  });
  authRepository.ensureRefreshTokenSchema = async () => {};
  authRepository.insertRefreshToken = async (payload) => {
    insertCalls.push(payload);
  };

  const authService = new AuthService();
  const result = await authService.login('test@example.com', 'Passw0rd!', {
    userAgent: 'unit-test-agent',
    ipAddress: '127.0.0.1',
  });

  assert.equal(typeof result.token, 'string');
  assert.equal(typeof result.refresh_token, 'string');
  assert.equal(result.user.email, 'test@example.com');

  const decodedAccess = jwt.verify(result.token, process.env.JWT_SECRET);
  assert.equal(decodedAccess.token_type, 'access');
  assert.equal(decodedAccess.id, '11111111-1111-1111-1111-111111111111');

  assert.equal(insertCalls.length, 1);
  assert.equal(insertCalls[0].userId, '11111111-1111-1111-1111-111111111111');
  assert.equal(insertCalls[0].tokenHash.length, 64);
});

test('should_reject_login_when_password_is_invalid', async () => {
  const passwordHash = await bcrypt.hash('CorrectPassword!', 4);

  authRepository.findUserForLoginByEmail = async () => ({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Test User',
    email: 'test@example.com',
    password: passwordHash,
    role: 'developer',
  });

  const authService = new AuthService();

  await assert.rejects(
    () => authService.login('test@example.com', 'WrongPassword!'),
    /Invalid credentials/,
  );
});

test('should_rotate_refresh_token_and_revoke_previous_token', async () => {
  const rotatedCalls = [];
  const insertedCalls = [];

  authRepository.ensureRefreshTokenSchema = async () => {};
  authRepository.findRefreshTokenByHash = async () => ({
    id: 'aaaa1111-1111-1111-1111-111111111111',
    user_id: '11111111-1111-1111-1111-111111111111',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    revoked_at: null,
  });
  authRepository.findUserById = async () => ({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Test User',
    email: 'test@example.com',
    role: 'developer',
  });
  authRepository.markRefreshTokenRotated = async (oldTokenId, newTokenId) => {
    rotatedCalls.push({ oldTokenId, newTokenId });
  };
  authRepository.insertRefreshToken = async (payload) => {
    insertedCalls.push(payload);
  };

  const refreshToken = jwt.sign(
    {
      id: '11111111-1111-1111-1111-111111111111',
      token_type: 'refresh',
      token_id: 'aaaa1111-1111-1111-1111-111111111111',
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' },
  );

  const authService = new AuthService();
  const result = await authService.rotateRefreshToken(refreshToken, {
    userAgent: 'unit-test-agent',
    ipAddress: '127.0.0.1',
  });

  assert.equal(typeof result.token, 'string');
  assert.equal(typeof result.refresh_token, 'string');
  assert.equal(rotatedCalls.length, 1);
  assert.equal(insertedCalls.length, 1);
  assert.equal(rotatedCalls[0].oldTokenId, 'aaaa1111-1111-1111-1111-111111111111');
  assert.equal(rotatedCalls[0].newTokenId, insertedCalls[0].tokenId);
});

test('should_revoke_specific_refresh_token_on_logout_when_refresh_token_is_provided', async () => {
  const revokedByHashCalls = [];
  const revokedByUserCalls = [];

  authRepository.ensureRefreshTokenSchema = async () => {};
  authRepository.revokeRefreshTokenByHash = async (tokenHash) => {
    revokedByHashCalls.push(tokenHash);
  };
  authRepository.revokeActiveRefreshTokensByUserId = async (userId) => {
    revokedByUserCalls.push(userId);
  };

  const accessToken = jwt.sign(
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Test User',
      email: 'test@example.com',
      role: 'developer',
      token_type: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );

  const authService = new AuthService();
  const result = await authService.logout(accessToken, 'refresh-token-value');

  assert.equal(result.message, 'Logged out successfully');
  assert.equal(revokedByHashCalls.length, 1);
  assert.equal(revokedByUserCalls.length, 0);
});
