# SECURITY_AI_CHECKLIST.md
> Use this file as the security checklist + instruction contract for AI changes.
> You (AI) must follow the "Rules of Engagement" and then execute Steps 1 → N exactly.

## Rules of Engagement (AI MUST FOLLOW)
1. Work step-by-step from **Step 1 to Step N** only (N will be provided by me).
2. For EACH step:
   - ✅ Explain the risk in 1–2 lines
   - ✅ Apply the fix with **minimal changes**
   - ✅ Show exact code/config (or file path + snippet)
   - ✅ Add/adjust tests (unit/integration) where relevant
   - ✅ Provide a quick manual test checklist
3. Do NOT:
   - change app behavior/UX unless required for security
   - introduce breaking API changes
   - add heavy dependencies without justification
   - log secrets / tokens / passwords
4. If a step does not apply, say: **“Not applicable because …”** and move on.
5. Keep security changes server-side enforceable (UI changes are not security).
6. Always assume attackers can call APIs directly (curl/Postman).

---

# Step 1 — Don’t Leave CORS Wide Open
**Problem:** Allowing `*` lets malicious sites call your API from a browser context.  
**Fix:** Allowlist only your production domains (and required dev domains).

**Requirements**
- Use an allowlist (exact match or safe wildcard like `*.myapp.com`).
- If cookies/credentials are used, ensure `Access-Control-Allow-Credentials=true` and never use `*`.

**Deliverables**
- Config change (backend) + environment-based domains
- Tests / verification steps (preflight OPTIONS + actual request)

---

# Step 2 — Validate Redirects (Prevent Open Redirect)
**Problem:** `?redirect=` can be abused to send users to phishing sites after login.  
**Fix:** Validate against an allowlist of internal paths/domains.

**Requirements**
- Allow only relative paths (recommended) like `/dashboard`
- OR allow only allowed hostnames
- Default fallback if invalid

**Deliverables**
- Validation function + tests for evil domains

---

# Step 3 — Lock Down File Storage (Uploads / Buckets)
**Problem:** Buckets accidentally public = user files exposed.  
**Fix:** Private by default + per-user access rules (RLS/policies).

**Requirements**
- “Owner-only” read/write by default
- Signed URLs for temporary access when needed
- Validate file type + size at upload

**Deliverables**
- Storage policy rules + example usage
- Test plan: user A cannot access user B file

---

# Step 4 — Remove Debug Statements (console.log / print)
**Problem:** Debug logs leak sensitive data in prod.  
**Fix:** Remove debug prints and replace with proper structured logging.

**Requirements**
- Strip console logs in production builds (where applicable)
- Server logs must redact secrets and PII

**Deliverables**
- Logging standard (what to log / what NOT to log)

---

# Step 5 — Always Verify Webhooks (Stripe, Paystack, etc.)
**Problem:** Anyone can POST fake “payment succeeded” if you don’t verify signatures.  
**Fix:** Verify signature using provider SDK + secret.

**Requirements**
- Reject if signature invalid
- Ensure webhook handler is idempotent (same event twice shouldn’t double-charge/double-credit)

**Deliverables**
- Verified webhook handler + idempotency key storage/check

---

# Step 6 — Check Permissions Server-Side
**Problem:** Hiding buttons doesn’t stop direct API calls.  
**Fix:** Enforce role/permission checks on the server for every protected route.

**Requirements**
- Enforce auth + authorization in middleware/guards
- For multi-tenant apps: enforce tenant ownership on every query (no IDOR)

**Deliverables**
- Middleware/guard examples + tests for forbidden access

---

# Step 7 — Protect Authentication From Brute Force + Credential Stuffing  ✅ (MISSING IN YOUR PHOTOS)
**Problem:** Unlimited login attempts = password guessing / credential stuffing.  
**Fix:** Rate-limit login + add temporary lockout/backoff + optional CAPTCHA after threshold.

**Requirements**
- Rate limit per IP AND per username/email (to stop distributed attacks)
- Progressive delay / temporary lock after N failures (e.g., 5 attempts → 15 min lock)
- Log security events (failed logins, lockouts) WITHOUT leaking whether the account exists

**Deliverables**
- Rate limiting + lockout implementation
- Tests: repeated failures trigger lockout; valid login resets counter
- Manual tests: verify error messages are generic (“Invalid credentials”)

---

# Step 8 — Add Rate Limits to Password Reset Requests
**Problem:** “Forgot password” spam → email bombing + token brute force.  
**Fix:** Limit resets per email + per IP.

**Requirements**
- Example: max 3 per email per hour + IP cap
- Always return generic response (“If an account exists…”) to prevent account enumeration

**Deliverables**
- Rate limiting + generic messaging

---

# Step 9 — Never Show Raw Errors to Users
**Problem:** Stack traces reveal file paths, code, infrastructure.  
**Fix:** Catch errors globally; return generic messages; log details server-side only.

**Requirements**
- Separate “public error” vs “internal error”
- Correlation ID returned to client for support

**Deliverables**
- Global error handler + logging policy

---

# Step 10 — Set Session Expiration + Refresh Token Rotation
**Problem:** Long-lived sessions = stolen cookie = long-lived access.  
**Fix:** Short-lived access token + refresh rotation + revoke on suspicious activity.

**Requirements**
- Access token TTL (e.g., 15 min)
- Refresh TTL (e.g., 7–30 days)
- Refresh token rotation (new refresh token every use; invalidate previous)
- Store refresh token hashed server-side
- Revoke refresh on logout/password change

**Deliverables**
- Token lifecycle + tests for rotation + revocation

---

---

# Step 11 — Secure Cookies & Transport (HTTPS, SameSite, HttpOnly, Secure)
**Problem:** Cookies/session tokens can be stolen via XSS, intercepted on insecure connections (MITM), or leaked cross-site.  
**Fix:** Enforce HTTPS everywhere and set secure cookie flags correctly.

**Requirements**
- Enforce HTTPS in production (redirect HTTP → HTTPS).
- Cookies containing auth/session must be:
  - `HttpOnly=true` (JS cannot read it)
  - `Secure=true` (HTTPS only)
  - `SameSite=Lax` by default, use `SameSite=Strict` when possible
  - If cross-site auth is required (e.g., separate domains), use `SameSite=None` + `Secure=true`
- Set a sane `Max-Age/Expires` aligned to your session policy.
- Avoid storing sensitive tokens in `localStorage` (prefer HttpOnly cookies).

**Deliverables**
- Cookie configuration changes (server-side)
- HTTPS enforcement (proxy/app config)
- Tests/verification:
  - Cookies include required flags in prod mode
  - HTTP requests redirect to HTTPS (prod)
- Manual test checklist:
  - Confirm cookies are not visible in JS (document.cookie)
  - Confirm cookies not set over HTTP

---

# Step 12 — Security Headers (CSP, HSTS, X-Frame-Options, etc.)
**Problem:** Missing headers enable clickjacking, XSS, MIME sniffing, and downgrade attacks.  
**Fix:** Add secure defaults and a CSP aligned to your frontend’s needs.

**Requirements**
- Set (at minimum) these headers in production:
  - `Strict-Transport-Security` (HSTS) with an appropriate max-age; consider preload only when ready
  - `Content-Security-Policy` (CSP): start strict, loosen only as required
  - `X-Frame-Options: DENY` or `SAMEORIGIN` (or CSP `frame-ancestors`)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin` (or stricter)
  - `Permissions-Policy` to disable unused browser features
- If you set both `X-Frame-Options` and CSP `frame-ancestors`, ensure they don’t conflict.
- CSP must account for:
  - your frontend domain(s)
  - CDN domains you actually use
  - inline scripts/styles only if unavoidable (prefer nonces/hashes)

**Deliverables**
- Middleware/config that applies headers consistently
- CSP template + note on how to update it safely
- Tests/verification:
  - Header presence on key routes
  - CSP does not break app functionality
- Manual test checklist:
  - Confirm headers in browser devtools/network tab
  - Try framing the site (should fail if DENY)

---

# Step 13 — Input Validation & Output Encoding (XSS/Injection baseline)
**Problem:** Untrusted input can cause XSS, SQL injection, NoSQL injection, command injection, and SSRF.  
**Fix:** Validate server-side, encode output, and use parameterized queries + safe APIs.

**Requirements**
- Validate all external input at API boundaries:
  - query params, body, headers, file metadata
  - enforce types, length, allowed values, formats
- Reject unknown fields where possible (strict schemas).
- Use parameterized queries / ORM safe methods (no string concatenation).
- Encode output in templates/HTML contexts (never render raw user HTML unless sanitized).
- Sanitize/validate URLs and prevent SSRF when fetching remote resources:
  - block internal IP ranges and metadata endpoints
- Normalize and validate IDs to prevent IDOR-style confusion.

**Deliverables**
- Validation layer/pattern (schema validators or built-in framework validation)
- Examples for:
  - “safe SQL/ORM usage”
  - “safe HTML rendering”
- Tests/verification:
  - invalid input returns 400 with generic message
  - injection payloads don’t execute (basic cases)
- Manual test checklist:
  - Try script tags in user fields (should not execute)
  - Try SQLi strings (should not change behavior)

---

# Step 14 — File Upload Hardening (MIME sniffing, size, AV scan if needed)
**Problem:** File uploads can be used for malware delivery, stored XSS, overwriting, or DoS via large files.  
**Fix:** Validate type/size, store safely, and serve securely.

**Requirements**
- Enforce upload limits:
  - max file size
  - max number of files per request/user
- Validate file type using:
  - allowlist of MIME types AND file signatures (magic bytes) where possible
- Rename stored files (never trust user filename); avoid path traversal.
- Store outside web root (or in managed storage like S3/Supabase private buckets).
- Serve files via:
  - signed URLs (preferred) or
  - authenticated download endpoints with authorization checks
- Strip metadata when appropriate (e.g., images).
- If your risk profile requires it:
  - add malware scanning (async queue) and quarantine until clean.

**Deliverables**
- Upload validation + storage rules
- Download access strategy (signed URL/auth endpoint)
- Tests/verification:
  - blocked types rejected
  - oversize rejected
  - user A cannot access user B uploads
- Manual test checklist:
  - try uploading `.html`, `.js`, `.exe` (should fail)
  - try large file (should fail)

---

# Step 15 — Secrets Management
**Problem:** Secrets in code/logs lead to full compromise (DB, payments, auth providers).  
**Fix:** Use environment variables or secret managers, rotate keys, and redact logs.

**Requirements**
- No secrets committed to git:
  - `.env` must be ignored
  - provide `.env.example` with placeholders only
- Store secrets using:
  - environment variables (minimum) or
  - secret manager (recommended for production)
- Rotate:
  - on leak suspicion
  - on staff changes
  - on schedule for critical secrets
- Redact secrets in logs and error reports:
  - never log tokens, passwords, API keys, cookies
- Separate secrets per environment (dev/staging/prod).
- Validate app startup fails fast if required secrets missing.

**Deliverables**
- Secret loading pattern + required secret list
- `.env.example` + documentation section
- Log redaction helpers/policy
- Tests/verification:
  - app fails to start if critical env missing (prod mode)
  - logs do not contain secret values
- Manual test checklist:
  - grep logs for “Bearer”, “api_key”, “password” patterns (should be clean)

---
---

## How to run this checklist (copy/paste instruction to AI)
**Command template:**
“Using SECURITY_AI_CHECKLIST.md, run Steps 1 → {N} in order on this codebase.
For each step: explain risk, implement minimal fix, show exact file edits, add tests, and give a manual test checklist.
Do not change product behavior beyond what security requires.”
