import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('24h'),
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
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('Invalid environment variables:', parseResult.error.format());
  process.exit(1);
}

export const config: EnvConfig = parseResult.data;
export const enableJudge = config.ENABLE_JUDGE.toLowerCase() === 'true';
export const runJudgeInApi = config.RUN_JUDGE_IN_API.toLowerCase() === 'true';
export const strictRealScoring = config.STRICT_REAL_SCORING.toLowerCase() === 'true';
export const adminPanelEnabled = config.ADMIN_PANEL_ENABLED.toLowerCase() === 'true';
