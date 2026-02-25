import { z } from 'zod';

const optionalHttpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
    message: 'Invalid URL protocol',
  })
  .optional()
  .nullable();

export const signupSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(256),
    role: z.string().trim().optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(256),
  })
  .strict();

export const codeRunSchema = z
  .object({
    language: z.string().trim().min(1).max(32),
    code: z.string().max(100_000),
    stdin: z.string().max(16_384).optional(),
    challenge_id: z.string().uuid().optional(),
  })
  .strict();

const evidenceLinksSchema = z
  .union([
    z.array(z.string().trim().min(1).max(512)).max(10),
    z.string().max(4096),
  ])
  .optional();

export const addWorkExperienceSchema = z
  .object({
    company_name: z.string().trim().min(1).max(180),
    role: z.string().trim().min(1).max(180),
    duration_months: z.coerce.number().positive().max(1200),
    evidence_links: evidenceLinksSchema,
  })
  .passthrough();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(254).optional(),
    avatar_url: optionalHttpUrl,
    headline: z.string().trim().max(180).optional().nullable(),
    bio: z.string().trim().max(2_000).optional().nullable(),
    location: z.string().trim().max(180).optional().nullable(),
    github_url: optionalHttpUrl,
    linkedin_url: optionalHttpUrl,
    portfolio_url: optionalHttpUrl,
  })
  .strict()
  .refine(
    (value) =>
      Object.values(value).some((field) => field !== undefined),
    {
      message: 'At least one profile field is required',
    },
  );

export const sessionIdParamSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const userIdParamSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict();
