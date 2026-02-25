import { createHash } from 'crypto';
import type { Request, RequestHandler, Response } from 'express';
import { logger } from '../utils/logger';

type AttemptRecord = {
  failures: number;
  windowStartMs: number;
  lockUntilMs: number;
};

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCK_AFTER_FAILURES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const ipAttempts = new Map<string, AttemptRecord>();
const accountAttempts = new Map<string, AttemptRecord>();

const now = () => Date.now();

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const getClientIp = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip || 'unknown';
};

const fingerprintEmail = (email: string): string => {
  if (!email) return 'anonymous';
  return createHash('sha256').update(email).digest('hex').slice(0, 12);
};

const getOrCreateRecord = (map: Map<string, AttemptRecord>, key: string): AttemptRecord => {
  const existing = map.get(key);
  const timestamp = now();
  if (!existing || timestamp - existing.windowStartMs > ATTEMPT_WINDOW_MS) {
    const fresh: AttemptRecord = {
      failures: 0,
      windowStartMs: timestamp,
      lockUntilMs: 0,
    };
    map.set(key, fresh);
    return fresh;
  }
  return existing;
};

const isLocked = (record: AttemptRecord): boolean => record.lockUntilMs > now();

const applyFailure = (record: AttemptRecord) => {
  const timestamp = now();
  if (timestamp - record.windowStartMs > ATTEMPT_WINDOW_MS) {
    record.windowStartMs = timestamp;
    record.failures = 0;
  }
  record.failures += 1;
  if (record.failures >= LOCK_AFTER_FAILURES) {
    record.lockUntilMs = timestamp + LOCK_DURATION_MS;
  }
};

const applySuccess = (record: AttemptRecord) => {
  record.failures = 0;
  record.lockUntilMs = 0;
  record.windowStartMs = now();
};

const genericRejected = (res: Response, status: number) =>
  res.status(status).json({
    success: false,
    message: 'Invalid credentials',
    error: 'INVALID_CREDENTIALS',
  });

export const resetLoginSecurityState = () => {
  ipAttempts.clear();
  accountAttempts.clear();
};

export const loginSecurityGuard: RequestHandler = (req, res, next) => {
  const ip = getClientIp(req);
  const email = normalizeEmail(req.body?.email);
  const accountKey = email || '__unknown__';
  const ipRecord = getOrCreateRecord(ipAttempts, ip);
  const accountRecord = getOrCreateRecord(accountAttempts, accountKey);

  if (isLocked(ipRecord) || isLocked(accountRecord)) {
    logger.warn('Authentication lockout triggered', {
      ip,
      email_hash: fingerprintEmail(email),
      reason: 'too_many_failed_attempts',
    });
    return genericRejected(res, 429);
  }

  const maxFailures = Math.max(ipRecord.failures, accountRecord.failures);
  const delayMs = maxFailures >= 3 ? Math.min(3000, (maxFailures - 2) * 500) : 0;

  res.on('finish', () => {
    const failed = res.statusCode >= 400 && res.statusCode < 500;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      applySuccess(ipRecord);
      applySuccess(accountRecord);
      return;
    }
    if (!failed) return;

    applyFailure(ipRecord);
    applyFailure(accountRecord);
    logger.warn('Authentication failure recorded', {
      ip,
      email_hash: fingerprintEmail(email),
      statusCode: res.statusCode,
      ip_failures: ipRecord.failures,
      account_failures: accountRecord.failures,
      ip_locked: isLocked(ipRecord),
      account_locked: isLocked(accountRecord),
    });
  });

  if (delayMs <= 0) {
    next();
    return;
  }

  setTimeout(next, delayMs);
};

