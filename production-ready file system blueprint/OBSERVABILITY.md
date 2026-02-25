# OBSERVABILITY.md

> Use this file as the monitoring and visibility contract.
> If you cannot observe it, you cannot trust it.

---

## Rules of Observability Enforcement 

1. All critical flows must be observable.
2. All errors must be logged with correlation IDs.
3. Production must have monitoring alerts.
4. Silent failures are unacceptable.

For every major feature:
- ✅ Confirm logging coverage
- ✅ Confirm metrics tracked
- ✅ Confirm alert triggers defined
- ✅ Confirm correlation IDs present

---

# 1. Logging Standards

Log:
- Errors
- Auth failures
- Rate limit triggers
- Payment failures
- Critical state changes

Do NOT log:
- Secrets
- Tokens
- Passwords

Logs must include:
- timestamp
- correlationId
- userId (if applicable)
- severity level

---

# 2. Metrics to Track

Minimum metrics:

- Request count
- Error rate
- 500 rate
- Latency (p50/p95)
- Auth failure rate
- Rate limit violations
- Queue/job failure rate

---

# 3. Alerting Rules

Alerts required for:
- High 500 rate
- DB connection failure
- Memory spike
- Auth abuse spike
- Payment failure spike

Alerts must:
- Have severity levels
- Avoid noise
- Be actionable

---

# 4. Health Endpoints

Provide:
- /health
- /ready (optional)

Health checks must:
- Verify DB connectivity
- Verify critical service connectivity

---

# 5. Tracing (Advanced)

Where possible:
- Trace request lifecycle
- Track slow endpoints
- Identify bottlenecks

---

## Command Template

“Using OBSERVABILITY.md,
audit this system for logging, metrics, and alerting gaps.
Confirm correlation IDs implemented.
Identify missing monitoring for critical flows.
Provide improvement plan.”

---