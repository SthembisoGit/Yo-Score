import type { Request, RequestHandler, Response } from 'express';
import { buildStructuredErrorResponse } from '../utils/errorResponse';
import { observeRateLimit } from '../observability/metrics';

type CounterRecord = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  message?: string;
  code?: string;
  keyPrefix?: string;
};

const counters = new Map<string, CounterRecord>();

const getClientIdentifier = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip || 'unknown';
};

const now = () => Date.now();

const purgeExpiredEntries = () => {
  const timestamp = now();
  for (const [key, record] of counters.entries()) {
    if (record.resetAt <= timestamp) {
      counters.delete(key);
    }
  }
};

let lastPurgeAt = 0;
const maybePurge = () => {
  const timestamp = now();
  if (timestamp - lastPurgeAt >= 60_000) {
    purgeExpiredEntries();
    lastPurgeAt = timestamp;
  }
};

const computeKey = (req: Request, keyPrefix: string) =>
  `${keyPrefix}:${req.method}:${req.baseUrl}${req.path}:${getClientIdentifier(req)}`;

export const createRateLimiter = (options: RateLimitOptions): RequestHandler => {
  const windowMs = Math.max(1_000, options.windowMs);
  const max = Math.max(1, options.max);
  const message = options.message ?? 'Too many requests, please try again later.';
  const code = options.code ?? 'RATE_LIMIT_EXCEEDED';
  const keyPrefix = options.keyPrefix ?? 'global';

  return (req: Request, res: Response, next) => {
    maybePurge();

    const key = computeKey(req, keyPrefix);
    const timestamp = now();
    const current = counters.get(key);

    if (!current || current.resetAt <= timestamp) {
      counters.set(key, {
        count: 1,
        resetAt: timestamp + windowMs,
      });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - timestamp) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      observeRateLimit();
      return res
        .status(429)
        .json(buildStructuredErrorResponse(req, code, message, { retryAfterSeconds }));
    }

    current.count += 1;
    counters.set(key, current);
    return next();
  };
};

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many authentication attempts. Please wait and try again.',
  code: 'AUTH_RATE_LIMIT',
  keyPrefix: 'auth',
});

export const submissionRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: 'Submission rate limit reached. Please retry shortly.',
  code: 'SUBMISSION_RATE_LIMIT',
  keyPrefix: 'submission',
});

export const codeRunRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 45,
  message: 'Code run rate limit reached. Please wait and retry.',
  code: 'CODE_RUN_RATE_LIMIT',
  keyPrefix: 'code-run',
});

export const proctoringIngestRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'Proctoring ingest rate limit reached. Slow down request frequency.',
  code: 'PROCTORING_RATE_LIMIT',
  keyPrefix: 'proctoring',
});
