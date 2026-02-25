import type { CookieOptions, Request } from 'express';
import { config } from '../config';

const parseDurationToMs = (value: string): number => {
  const trimmed = value.trim().toLowerCase();
  const match = /^(\d+)\s*([smhd])$/.exec(trimmed);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const unitToMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (unitToMs[unit] ?? 24 * 60 * 60 * 1000);
};

export const parseCookie = (cookieHeader: string | undefined, key: string): string | null => {
  if (!cookieHeader || !key) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.split('=');
    if (!rawKey) continue;
    if (rawKey.trim() === key) {
      return decodeURIComponent(rawValue.join('=').trim());
    }
  }
  return null;
};

export const getRefreshCookieOptions = (): CookieOptions => {
  const isProduction = config.NODE_ENV === 'production';
  const sameSite = config.AUTH_COOKIE_SAME_SITE;
  const maxAge = parseDurationToMs(config.REFRESH_TOKEN_TTL);
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: sameSite === 'none' ? 'none' : sameSite === 'strict' ? 'strict' : 'lax',
    path: '/api/auth',
    maxAge,
  };
};

export const extractRefreshTokenFromRequest = (req: Request): string | null => {
  const cookieToken = parseCookie(req.headers.cookie, config.REFRESH_COOKIE_NAME);
  if (cookieToken) return cookieToken;
  if (typeof req.body?.refresh_token === 'string' && req.body.refresh_token.trim().length > 0) {
    return req.body.refresh_token.trim();
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1]?.trim() || null;
  }
  return null;
};
