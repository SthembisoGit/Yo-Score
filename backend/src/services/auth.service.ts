import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { authRepository } from '../repositories/auth.repository';

export interface UserPayload {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface AccessTokenPayload extends UserPayload {
    token_type: 'access';
}

interface RefreshTokenPayload {
    id: string;
    token_type: 'refresh';
    token_id: string;
}

const ALLOWED_SIGNUP_ROLES = new Set(['developer', 'recruiter']);
const ACCESS_TOKEN_EXPIRES_IN = (config.ACCESS_TOKEN_TTL || config.JWT_EXPIRES_IN) as jwt.SignOptions['expiresIn'];
const REFRESH_TOKEN_EXPIRES_IN = config.REFRESH_TOKEN_TTL as jwt.SignOptions['expiresIn'];
const REFRESH_SECRET =
    config.NODE_ENV === 'production'
        ? String(config.REFRESH_TOKEN_SECRET)
        : (config.REFRESH_TOKEN_SECRET || config.JWT_SECRET);

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export class AuthService {
    private refreshSchemaEnsured = false;

    private async ensureRefreshTokenSchema() {
        if (this.refreshSchemaEnsured) return;
        await authRepository.ensureRefreshTokenSchema();
        this.refreshSchemaEnsured = true;
    }

    private createAccessToken(payload: UserPayload): string {
        const accessPayload: AccessTokenPayload = {
            ...payload,
            token_type: 'access',
        };
        return jwt.sign(accessPayload, config.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
    }

    private createRefreshToken(userId: string): { token: string; tokenId: string } {
        const tokenId = randomUUID();
        const refreshPayload: RefreshTokenPayload = {
            id: userId,
            token_type: 'refresh',
            token_id: tokenId,
        };
        return {
            token: jwt.sign(refreshPayload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN }),
            tokenId,
        };
    }

    private decodeRefreshToken(refreshToken: string): RefreshTokenPayload {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET) as Partial<RefreshTokenPayload>;
        if (!payload || payload.token_type !== 'refresh' || !payload.id || !payload.token_id) {
            throw new Error('Invalid refresh token');
        }
        return payload as RefreshTokenPayload;
    }

    private getExpiryFromJwt(token: string): Date {
        const decoded = jwt.decode(token) as { exp?: number } | null;
        if (!decoded?.exp) {
            throw new Error('Invalid token expiry');
        }
        return new Date(decoded.exp * 1000);
    }

    private async persistRefreshToken(args: {
        userId: string;
        token: string;
        tokenId: string;
        userAgent?: string;
        ipAddress?: string;
        replacedByTokenId?: string | null;
    }) {
        await this.ensureRefreshTokenSchema();
        const expiresAt = this.getExpiryFromJwt(args.token);
        await authRepository.insertRefreshToken({
            tokenId: args.tokenId,
            userId: args.userId,
            tokenHash: sha256(args.token),
            expiresAtIso: expiresAt.toISOString(),
            userAgent: args.userAgent,
            ipAddress: args.ipAddress,
            replacedByTokenId: args.replacedByTokenId ?? null,
        });
    }

    private async issueTokenPair(
        user: { id: string; name: string; email: string; role: string },
        context?: { userAgent?: string; ipAddress?: string },
    ): Promise<{ token: string; refresh_token: string }> {
        const token = this.createAccessToken({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        });
        const refresh = this.createRefreshToken(user.id);
        await this.persistRefreshToken({
            userId: user.id,
            token: refresh.token,
            tokenId: refresh.tokenId,
            userAgent: context?.userAgent,
            ipAddress: context?.ipAddress,
        });
        return { token, refresh_token: refresh.token };
    }

    async signup(name: string, email: string, password: string, role: string = 'developer') {
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedRole = role.trim().toLowerCase();
        const safeRole = ALLOWED_SIGNUP_ROLES.has(normalizedRole) ? normalizedRole : 'developer';

        // Check if user already exists
        const existingUser = await authRepository.findUserIdByEmail(normalizedEmail);
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Hash password
        const saltRounds = config.BCRYPT_SALT_ROUNDS;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const user = await authRepository.createUser({
            name: name.trim(),
            email: normalizedEmail,
            passwordHash,
            role: safeRole,
        });

        const tokens = await this.issueTokenPair({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        });

        return {
            token: tokens.token,
            refresh_token: tokens.refresh_token,
            user: {
                user_id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        };
    }

    async login(
        email: string,
        password: string,
        context?: { userAgent?: string; ipAddress?: string },
    ) {
        const normalizedEmail = email.trim().toLowerCase();

        // Find user
        const user = await authRepository.findUserForLoginByEmail(normalizedEmail);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            throw new Error('Invalid credentials');
        }

        const tokens = await this.issueTokenPair(
            {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            context,
        );

        return {
            token: tokens.token,
            refresh_token: tokens.refresh_token,
            user: {
                user_id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        };
    }

    async logout(accessToken: string, refreshToken?: string) {
        const user = this.verifyToken(accessToken);
        await this.ensureRefreshTokenSchema();
        if (refreshToken) {
            await authRepository.revokeRefreshTokenByHash(sha256(refreshToken));
        } else {
            await authRepository.revokeActiveRefreshTokensByUserId(user.id);
        }
        return { message: 'Logged out successfully' };
    }

    async rotateRefreshToken(
        refreshToken: string,
        context?: { userAgent?: string; ipAddress?: string },
    ): Promise<{ token: string; refresh_token: string }> {
        await this.ensureRefreshTokenSchema();
        const decoded = this.decodeRefreshToken(refreshToken);

        const current = await authRepository.findRefreshTokenByHash(sha256(refreshToken));
        if (!current) {
            throw new Error('Invalid refresh token');
        }
        if (current.revoked_at) {
            throw new Error('Refresh token already revoked');
        }
        const expiresAt = new Date(current.expires_at);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
            throw new Error('Refresh token expired');
        }
        if (String(current.user_id) !== decoded.id) {
            throw new Error('Invalid refresh token subject');
        }

        const user = await authRepository.findUserById(decoded.id);
        if (!user) {
            throw new Error('User not found');
        }

        const token = this.createAccessToken({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        });

        const refresh = this.createRefreshToken(user.id);
        await authRepository.markRefreshTokenRotated(current.id, refresh.tokenId);
        await this.persistRefreshToken({
            userId: user.id,
            token: refresh.token,
            tokenId: refresh.tokenId,
            userAgent: context?.userAgent,
            ipAddress: context?.ipAddress,
        });

        return { token, refresh_token: refresh.token };
    }

    verifyToken(token: string): UserPayload {
        const decoded = jwt.verify(token, config.JWT_SECRET) as Partial<AccessTokenPayload>;
        if (!decoded || decoded.token_type !== 'access') {
            logger.warn('Rejected non-access token on authenticated endpoint');
            throw new Error('Invalid token type');
        }
        return {
            id: String(decoded.id),
            name: String(decoded.name),
            email: String(decoded.email),
            role: String(decoded.role),
        };
    }
}
