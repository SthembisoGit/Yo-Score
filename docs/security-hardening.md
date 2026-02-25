# YoScore Security Hardening Notes

## Logging standard
- Use structured JSON logs via `backend/src/utils/logger.ts`.
- Never log raw passwords, bearer tokens, API keys, cookies, or refresh tokens.
- Log request context with correlation IDs (`x-correlation-id`) for traceability.
- Return generic error messages to clients; keep technical details server-side only.

## Required backend secrets (production)
- `DATABASE_URL`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `ONECOMPILER_ACCESS_TOKEN` or `ONECOMPILER_API_KEY` (if remote execution is enabled)

App startup fails fast in production when critical auth secrets are unsafe or missing.

## File upload and storage policy baseline
- Proctoring uploads enforce type and size limits server-side (magic bytes + parser size caps).
- Supabase avatar storage policy template is in `backend/db/storage_policies.sql`:
  - private bucket
  - owner-only read/write/delete
  - signed URL model for temporary access

## Not-applicable checklist steps
- Webhook signature verification is currently not applicable: no payment/provider webhook routes exist.
- Password reset rate limit is currently not applicable: no password-reset endpoint exists.
