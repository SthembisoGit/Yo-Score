import { query } from '../db';

export type AuthUserRecord = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
};

export type AuthUserPublicRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type RefreshTokenRecord = {
  id: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
};

export class AuthRepository {
  async ensureRefreshTokenSchema(): Promise<void> {
    await query(
      `CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ NULL,
          replaced_by_token_id UUID NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          user_agent TEXT NULL,
          ip_address TEXT NULL
      )`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id
       ON auth_refresh_tokens(user_id)`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires_at
       ON auth_refresh_tokens(expires_at)`,
    );
  }

  async findUserIdByEmail(email: string): Promise<{ id: string } | null> {
    const result = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return null;
    return { id: String(result.rows[0].id) };
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: string;
  }): Promise<AuthUserPublicRecord> {
    const result = await query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [input.name, input.email, input.passwordHash, input.role],
    );
    return result.rows[0] as AuthUserPublicRecord;
  }

  async findUserForLoginByEmail(email: string): Promise<AuthUserRecord | null> {
    const result = await query(
      'SELECT id, name, email, password, role FROM users WHERE email = $1',
      [email],
    );
    if (result.rows.length === 0) return null;
    return result.rows[0] as AuthUserRecord;
  }

  async findUserById(userId: string): Promise<AuthUserPublicRecord | null> {
    const result = await query('SELECT id, name, email, role FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as AuthUserPublicRecord;
  }

  async insertRefreshToken(input: {
    tokenId: string;
    userId: string;
    tokenHash: string;
    expiresAtIso: string;
    userAgent?: string;
    ipAddress?: string;
    replacedByTokenId?: string | null;
  }): Promise<void> {
    await query(
      `INSERT INTO auth_refresh_tokens
          (id, user_id, token_hash, expires_at, user_agent, ip_address, replaced_by_token_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.tokenId,
        input.userId,
        input.tokenHash,
        input.expiresAtIso,
        input.userAgent || null,
        input.ipAddress || null,
        input.replacedByTokenId || null,
      ],
    );
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const result = await query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM auth_refresh_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );
    if (result.rows.length === 0) return null;
    return result.rows[0] as RefreshTokenRecord;
  }

  async revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
    await query(
      `UPDATE auth_refresh_tokens
       SET revoked_at = NOW()
       WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeActiveRefreshTokensByUserId(userId: string): Promise<void> {
    await query(
      `UPDATE auth_refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId],
    );
  }

  async markRefreshTokenRotated(tokenId: string, replacedByTokenId: string): Promise<void> {
    await query(
      `UPDATE auth_refresh_tokens
       SET revoked_at = NOW(),
           replaced_by_token_id = $2
       WHERE id = $1`,
      [tokenId, replacedByTokenId],
    );
  }
}

export const authRepository = new AuthRepository();
