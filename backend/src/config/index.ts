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
  ENABLE_JUDGE: z.string().default('false'),
  RUN_JUDGE_IN_API: z.string().default('false'),
  REDIS_URL: z.string().optional(),
  STRICT_REAL_SCORING: z.string().default('true'),
  ADMIN_PANEL_ENABLED: z.string().default('true'),
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
