# API_CONTRACT.md

> Use this file as the source of truth for API behavior and compatibility.
> All endpoints must follow these rules consistently.
> Breaking changes are not allowed unless explicitly approved.

---

## Rules of API Enforcement 

1. Preserve backward compatibility by default.
2. Every endpoint must have:
   - request schema
   - response schema
   - auth requirements
   - error cases (mapped to ERROR_HANDLING_POLICY.md)
3. All responses must use a consistent envelope.
4. Input must be validated server-side (see SECURITY_CHECKLIST.md Step 13).
5. Authorization must be enforced server-side (see ARCHITECTURE.md).

Do NOT:
- Return inconsistent response shapes across endpoints
- Introduce breaking response changes silently
- Leak internal error messages or stack traces
- Accept unknown fields without intent (prefer strict schemas)

---

# 1. API Versioning Policy

Default:
- Use versioned base path, e.g. `/api/v1/...`

Rules:
- New non-breaking fields are allowed (additive only).
- Renaming/removing fields is breaking and requires a new version.
- Changing field meaning is breaking.
- Changing status codes is breaking unless aligned to policy.

Deprecation:
- Mark deprecated endpoints clearly in docs.
- Provide replacement endpoint/version.

---

# 2. Standard Response Envelope

All successful responses must follow:

{
  "success": true,
  "data": <payload>,
  "meta": {
    "correlationId": "uuid"
  }
}

Notes:
- `meta` is optional but recommended for correlationId, pagination, warnings.
- Never return raw objects without envelope unless explicitly documented.

---

# 3. Standard Error Envelope

All errors must follow ERROR_HANDLING_POLICY.md:

{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-safe message",
    "correlationId": "uuid"
  }
}

---

# 4. Status Code Rules

Use consistent HTTP status codes:

- 200 OK: Successful read/update actions
- 201 Created: Resource created
- 204 No Content: Successful delete with no body (optional; if used, no envelope)
- 400 Bad Request: Validation / malformed input
- 401 Unauthorized: Not authenticated
- 403 Forbidden: Authenticated but not allowed
- 404 Not Found: Missing resource or intentionally hidden
- 409 Conflict: Duplicate/state conflict/idempotency conflict
- 422 Unprocessable Entity: Optional (only if your project uses it consistently)
- 429 Too Many Requests: Rate limiting
- 500 Internal Server Error: Unexpected failures

Rule:
- Do not mix 200 + error payloads.
- If you choose to always return 200 with envelope, document it explicitly (not recommended).

---

# 5. Pagination Standard (List Endpoints)

For list responses, use:

{
  "success": true,
  "data": [ ... ],
  "meta": {
    "correlationId": "uuid",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 123,
      "totalPages": 7
    }
  }
}

Rules:
- Always apply pagination for potentially large lists.
- Set maximum page size (e.g., 100).
- Support stable sorting.

---

# 6. Filtering & Sorting Standard

Rules:
- Filtering must be explicit and allowlisted (no arbitrary query injection).
- Sorting must be allowlisted fields only.
- Default sort should be stable (e.g., `created_at desc`).

---

# 7. Idempotency Rules

Idempotency is required for:
- payments
- webhooks
- retries on unstable networks

Rules:
- Accept an idempotency key header when relevant.
- Store key + outcome.
- Return same result for same key.

---

# 8. Authentication Rules

Rules:
- Every protected endpoint must document:
  - auth required (yes/no)
  - auth method (token/cookie)
  - required roles/permissions

No endpoint may rely on “hidden frontend buttons” as security.

---

# 9. Authorization Rules (Multi-tenant / RBAC)

Rules:
- Tenant ownership must be enforced server-side.
- Resource access checks must be done in services (or dedicated auth layer).
- Avoid IDOR: never allow users to access resources by changing IDs.

---

# 10. Input Validation Rules

Rules:
- Validate at boundary (controller/route).
- Reject unknown fields where possible.
- Validate IDs and query parameters.
- Enforce strict types and max lengths.
- Sanitize/validate URLs to prevent SSRF.

---

# 11. Contract Documentation Template (Per Endpoint)

Use this template for each endpoint:

## Endpoint: {METHOD} /api/v1/{path}

**Description**
- What it does

**Auth**
- Required: Yes/No
- Roles/Permissions: {list}

**Request**
Headers:
- {header}: {description}

Query Params:
- {param}: {type} {rules}

Body:
- {field}: {type} {rules}

**Success Response**
Status: {200/201}
Body:
- Envelope + example payload

**Error Cases**
- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 403 FORBIDDEN
- 404 NOT_FOUND
- 409 CONFLICT
- 429 RATE_LIMITED
- 500 INTERNAL_ERROR

**Notes**
- Pagination/sorting/idempotency if applicable

---

# 12. Change Control Rule for Contributors

When implementing or modifying APIs:

1. Identify if change is breaking or additive.
2. Preserve existing fields and semantics.
3. Update contract docs for affected endpoints.
4. Add tests for:
   - success case
   - auth/forbidden case
   - validation failure
   - not found case

---

## How to run this API contract (operator procedure)

**Command template:**

“Using API_CONTRACT.md, implement/update endpoint(s): {list endpoints}.
Keep response envelope consistent.
Preserve backward compatibility.
Validate input at boundary.
Enforce authorization server-side.
Update the endpoint contract docs + tests.
Show file paths modified and confirm no breaking changes.”

---
