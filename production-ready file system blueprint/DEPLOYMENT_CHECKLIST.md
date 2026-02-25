# DEPLOYMENT_CHECKLIST.md

> Use this file as the production readiness contract.
> No release may go live unless this checklist passes.
> Deployment without verification is not allowed.

---

## Rules of Deployment Enforcement 

1. Treat production as hostile and irreversible.
2. Never deploy untested code.
3. Never deploy without security validation.
4. Never deploy without confirming environment configuration.
5. Confirm rollback capability before release.

For every deployment:
- ✅ Confirm tests pass
- ✅ Confirm security posture intact
- ✅ Confirm environment variables configured
- ✅ Confirm logging/monitoring active
- ✅ Confirm database migration safety
- ✅ Confirm rollback plan

Do NOT:
- Deploy with debug mode enabled
- Deploy with console logs leaking sensitive data
- Deploy without rate limits
- Deploy without HTTPS enforced
- Deploy without verifying database migrations

---

# 1. Pre-Deployment Verification

## Code Quality
- All tests passing
- No skipped tests without justification
- No TODO/FIXME left unresolved (unless documented)
- No commented-out critical logic

## Security
- CORS restricted to allowed domains
- Rate limits enabled
- Auth enforcement verified
- Debug logs removed
- Secrets not hardcoded
- Security headers enabled
- HTTPS enforced
- Cookie flags correctly set

## Architecture
- No layer violations
- No circular dependencies
- No business logic in controllers

---

# 2. Environment Configuration Check

Confirm for production:

- All required environment variables set
- No development keys used
- Database connection correct
- Storage bucket correct
- Email/payment providers set to production mode
- Secrets loaded securely
- App fails fast if required env missing

Never:
- Share production secrets in chat/logs
- Store secrets in version control

---

# 3. Database Migration Safety

Before applying migrations:

- Review schema changes
- Confirm no destructive drops without backup
- Confirm indexes added where needed
- Confirm foreign keys preserved
- Test migration in staging

For destructive migrations:
- Backup database
- Confirm restore procedure works

---

# 4. Logging & Monitoring Verification

Confirm:

- Error logging enabled
- Correlation IDs working
- Monitoring system connected
- Alert thresholds configured
- 500 errors trigger alerts
- Auth failures monitored
- Rate limit violations monitored

---

# 5. Performance Check

Before release:

- No N+1 queries introduced
- Pagination enforced on list endpoints
- No synchronous heavy blocking tasks
- No infinite retry loops
- Memory usage acceptable

If major change:
- Run load test (where feasible)

---

# 6. Rollback Strategy

Before deployment:

- Confirm previous version available
- Confirm rollback command/process documented
- Confirm database rollback strategy

Never deploy if rollback path unknown.

---

# 7. Post-Deployment Verification

Immediately after release:

- Health endpoint returns success
- Core flows manually tested
- Auth flow tested
- Critical business actions tested
- Logs monitored for errors
- Metrics monitored for anomalies

---

# 8. Production Safeguards

Production must:

- Disable debug mode
- Disable test endpoints
- Disable development-only features
- Enforce HTTPS
- Enforce secure cookies
- Enforce rate limiting

---

# 9. Change Classification

Before deployment, classify change:

- Patch (bug fix, no schema change)
- Minor (new feature, additive)
- Major (breaking change / migration)

Major changes require:
- Staging validation
- Backup verification
- Stakeholder approval

---

# 10. Emergency Fix Policy

For hotfixes:

- Minimal change only
- Add regression test immediately after
- Verify no new security risks
- Document root cause

---

# 11. Definition of Deployment Done

Deployment is NOT complete unless:

- Tests passed
- Security validated
- Monitoring active
- No spike in 500 errors
- No performance regression
- Rollback confirmed viable

---

## How to run this deployment checklist (operator procedure)

**Command template:**

“Using DEPLOYMENT_CHECKLIST.md, prepare this project for production.
Run pre-deployment validation.
Confirm security posture intact.
Confirm environment configuration complete.
Confirm migration safety.
Confirm rollback plan.
Provide a deployment readiness report.”

---