# ERROR_HANDLING_POLICY.md

> Use this file as the error management contract for the system.
> All errors must follow this structure and handling policy.
> No raw or unstructured errors may reach users.

---

## Rules of Error Enforcement 

1. All errors must be structured.
2. Services throw domain errors — not HTTP responses.
3. Controllers convert domain errors into transport responses.
4. Never expose stack traces to users.
5. Log full error details server-side only.

For every feature:
- ✅ Define possible error cases
- ✅ Map errors to proper status codes
- ✅ Preserve structured error format
- ✅ Confirm no sensitive data leakage

Do NOT:
- Return raw exception messages
- Leak database errors
- Leak internal file paths
- Leak third-party provider errors directly
- Swallow errors silently

---

# 1. Standard Error Response Format

All API errors must follow this structure:

{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-safe message",
    "correlationId": "uuid"
  }
}

Rules:
- `code` must be machine-readable.
- `message` must be safe for users.
- `correlationId` must link to server logs.

---

# 2. Error Classification

## 2.1 Validation Errors (400)

Examples:
- Missing required field
- Invalid format
- Unsupported value

Response:
- Do not expose internal schema structure.
- Provide clear but safe feedback.

---

## 2.2 Authentication Errors (401)

Examples:
- Missing token
- Expired token
- Invalid token

Rules:
- Do not reveal whether token exists.
- Do not differentiate “user not found” vs “password wrong.”

---

## 2.3 Authorization Errors (403)

Examples:
- Insufficient role
- Tenant ownership violation

Rules:
- Do not reveal existence of resource.
- Generic denial message.

---

## 2.4 Not Found (404)

Examples:
- Resource does not exist
- Hidden resource due to authorization

Rules:
- Do not reveal internal IDs or database details.

---

## 2.5 Conflict Errors (409)

Examples:
- Duplicate resource
- State conflict
- Idempotency violation

---

## 2.6 Rate Limiting (429)

Examples:
- Too many login attempts
- Excessive API usage

Must include:
- Retry guidance if appropriate

---

## 2.7 Server Errors (500)

Examples:
- Unexpected exception
- Infrastructure failure
- External dependency failure

Rules:
- Generic message to user
- Full details logged internally
- Correlation ID required

---

# 3. Domain Error Pattern

Services must throw structured domain errors.

Domain error must include:
- code
- internalMessage
- httpStatus

Controllers:
- Convert to standard error format
- Attach correlation ID
- Log internalMessage

---

# 4. Logging Requirements

Log:
- Full stack trace
- Internal error message
- Request ID / correlation ID
- User ID (if available)

Do NOT log:
- Passwords
- Tokens
- Secrets
- Full request payload unless sanitized

---

# 5. Correlation ID Policy

- Every request must have a correlation ID.
- If none provided, generate one.
- Include it in:
  - Logs
  - Error response
  - Monitoring system

---

# 6. External Adapter Errors

Adapters must:
- Catch provider-specific errors
- Convert to internal domain errors
- Never leak provider messages directly

Bad:
“Stripe: invalid API key  sk_live_123…”

Good:
“Payment processing failed.”

---

# 7. Async & Background Errors

Background jobs must:
- Log errors with correlation IDs
- Retry when safe
- Avoid infinite retry loops
- Escalate persistent failures

---

# 8. Error Consistency Rules

All endpoints must:
- Use the same error format
- Use consistent status code mapping
- Avoid mixing success and error structures

Never return:
{
  "error": "something broke"
}

---

# 9. Security Safeguards

Errors must not:
- Confirm user existence
- Reveal system architecture
- Reveal third-party configuration
- Leak environment variables

---

# 10. Change Control Rule for Contributors

When modifying error logic:

1. Identify error categories affected.
2. Confirm mapping to proper HTTP codes.
3. Confirm error structure unchanged.
4. Confirm no sensitive data leakage.
5. Confirm correlation ID preserved.

---

# 11. Definition of Done (Errors)

A feature is NOT complete unless:

- All failure paths identified
- Proper status codes mapped
- Error structure consistent
- Sensitive data protected
- Tests updated for failure scenarios

---

## How to run this error policy (operator procedure)

**Command template:**

“Using ERROR_HANDLING_POLICY.md, ensure all new and modified logic follows structured error rules.
Map domain errors correctly.
Preserve standard error response format.
Confirm no sensitive data leakage.
Show file paths modified and confirm consistency.”

---