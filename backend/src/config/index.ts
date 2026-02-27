import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  REFRESH_TOKEN_SECRET: z.string().optional(),
  REFRESH_COOKIE_NAME: z.string().default('yoScore_refresh_token'),
  AUTH_COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  ML_SERVICE_URL: z.string().default('http://localhost:5000'),
  ML_SERVICE_TIMEOUT: z.coerce.number().default(10000),
  ONECOMPILER_BASE_URL: z.string().default('https://onecompiler.com/api/v1'),
  ONECOMPILER_ACCESS_TOKEN: z.string().optional(),
  ONECOMPILER_API_KEY: z.string().optional(),
  ONECOMPILER_REQUEST_TIMEOUT_MS: z.coerce.number().default(25000),
  CODE_EXEC_TIMEOUT_MS: z.coerce.number().default(15000),
  CODE_EXEC_MAX_STDIN_BYTES: z.coerce.number().default(16_384),
  CODE_EXEC_MAX_CODE_BYTES: z.coerce.number().default(65_536),
  CODE_EXEC_MAX_OUTPUT_BYTES: z.coerce.number().default(131_072),
  ENABLE_JUDGE: z.string().default('false'),
  RUN_JUDGE_IN_API: z.string().default('false'),
  REDIS_URL: z.string().optional(),
  STRICT_REAL_SCORING: z.string().default('true'),
  ADMIN_PANEL_ENABLED: z.string().default('true'),
  PROCTORING_EVIDENCE_RETENTION_DAYS: z.coerce.number().default(7),
  PROCTORING_ENCRYPTED_KEY_ID: z.string().default('yoscore-default-key'),
  PROCTORING_CONSENSUS_WINDOW_SECONDS: z.coerce.number().default(30),
  PROCTORING_HIGH_CONFIDENCE_THRESHOLD: z.coerce.number().default(0.85),
  PROCTORING_REQUIRE_CONSENT: z.string().default('true'),
  PROCTORING_PRIVACY_POLICY_VERSION: z.string().default('2026-02-25'),
  PROCTORING_PRIVACY_POLICY_URL: z.string().optional(),
  PROCTORING_SNAPSHOT_PROCESSING_MODE: z.enum(['metadata', 'ml']).default('metadata'),
  PROCTORING_SUBMISSION_WAIT_SECONDS: z.coerce.number().default(30),
  PROCTORING_SUBMISSION_WAIT_POLL_MS: z.coerce.number().default(500),
  PROCTORING_PURGE_INTERVAL_HOURS: z.coerce.number().default(24),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  process.stderr.write(
    `Invalid environment variables: ${JSON.stringify(parseResult.error.format())}\n`,
  );
  process.exit(1);
}

const parsedConfig: EnvConfig = parseResult.data;

const isPlaceholderSecret = (value: string): boolean => {
  const lowered = value.trim().toLowerCase();
  if (!lowered) return true;
  return (
    lowered.includes('replace-with') ||
    lowered.includes('changeme') ||
    lowered.includes('example') ||
    lowered === 'test-secret'
  );
};

if (parsedConfig.NODE_ENV === 'production') {
  if (isPlaceholderSecret(parsedConfig.JWT_SECRET)) {
    process.stderr.write(
      'Invalid production secret: JWT_SECRET must be a strong, non-placeholder value.\n',
    );
    process.exit(1);
  }
  if (!parsedConfig.REFRESH_TOKEN_SECRET) {
    process.stderr.write(
      'Invalid production secret: REFRESH_TOKEN_SECRET is required in production.\n',
    );
    process.exit(1);
  }
  if (isPlaceholderSecret(parsedConfig.REFRESH_TOKEN_SECRET)) {
    process.stderr.write(
      'Invalid production secret: REFRESH_TOKEN_SECRET must be a strong, non-placeholder value.\n',
    );
    process.exit(1);
  }
}

export const config: EnvConfig = parsedConfig;
export const enableJudge = config.ENABLE_JUDGE.toLowerCase() === 'true';
export const runJudgeInApi = config.RUN_JUDGE_IN_API.toLowerCase() === 'true';
export const strictRealScoring = config.STRICT_REAL_SCORING.toLowerCase() === 'true';
export const adminPanelEnabled = config.ADMIN_PANEL_ENABLED.toLowerCase() === 'true';
