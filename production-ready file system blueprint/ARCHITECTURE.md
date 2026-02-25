# ARCHITECTURE.md

> Use this file as the structural contract for all system changes.
> You (AI) must follow the Architectural Rules of Enforcement before writing or modifying code.
> Do not introduce new patterns unless explicitly justified.

---

## Rules of Architectural Enforcement (AI MUST FOLLOW)

1. Identify affected layer(s) before writing code:
   - Controller / Route
   - Service
   - Repository
   - Middleware / Guard
   - Adapter / External Integration
   - Validator
   - Config / Infrastructure

2. Respect dependency direction strictly:
   - Controller → Service
   - Service → Repository
   - Service → Adapter
   - Repository → Database
   - Never reverse this flow.

3. For every architectural change:
   - ✅ Explain which layer is being modified
   - ✅ Confirm dependency direction remains valid
   - ✅ Show exact file paths modified
   - ✅ Keep business logic out of controllers
   - ✅ Keep database logic inside repositories only
   - ✅ Keep external providers wrapped in adapters
   - ✅ Confirm no circular dependencies introduced

4. Do NOT:
   - Collapse layers for convenience
   - Call the database directly from controllers
   - Let repositories call services
   - Introduce global state without justification
   - Mix authorization logic into repositories
   - Move validation logic deep inside services (it belongs at the boundary)

5. If a requested change violates architecture:
   - Stop
   - Explain the violation
   - Propose a compliant alternative

---

# 1. Architecture Principles

1. Separation of concerns is mandatory.
2. Business logic must NOT live in controllers/routes.
3. Authorization must be enforced server-side.
4. External services must be abstracted behind adapters.
5. All dependencies flow inward (outer layers depend on inner layers).
6. Code must remain testable independent of framework.
7. Architecture must prioritize clarity over cleverness.

Preferred pattern:

Controller → Service → Repository → Database  
                     ↓  
                 External Adapters

---

# 2. Layer Definitions

## 2.1 Controllers / Routes (Transport Layer)

**Responsibilities**
- Accept HTTP requests
- Validate input (schema validation only)
- Call services
- Return formatted responses

**Must NOT**
- Contain business logic
- Access database directly
- Perform authorization logic inline (use middleware/guards)
- Call external providers directly

---

## 2.2 Services (Business Logic Layer)

**Responsibilities**
- Contain all core business logic
- Orchestrate repositories and external services
- Enforce domain rules
- Throw structured domain errors

**Must NOT**
- Access HTTP request/response objects
- Depend on framework-specific features
- Return raw database models without mapping
- Perform direct SQL queries

---

## 2.3 Repositories (Data Access Layer)

**Responsibilities**
- Handle database queries
- Map data models
- Isolate ORM or database engine usage

**Rules**
- No business logic
- No authorization logic
- Use parameterized queries only
- Enforce tenant filters where applicable

---

## 2.4 Middleware / Guards

**Responsibilities**
- Authentication
- Authorization
- Rate limiting
- Security headers
- Logging
- Request context enrichment

Middleware must not contain business rules.

---

## 2.5 External Adapters

All integrations (payments, email, storage, third-party APIs) must:

- Be wrapped in adapter classes/modules
- Not be called directly from controllers
- Handle provider-specific errors internally
- Convert provider responses into internal format

This prevents vendor lock-in and provider leakage.

---

# 3. Folder Structure (Framework Agnostic)

Example structure:

/src  
  /controllers  
  /services  
  /repositories  
  /middleware  
  /adapters  
  /validators  
  /utils  
  /config  
/tests  

Rules:
- One responsibility per file
- Avoid files exceeding 300–400 lines
- Avoid circular dependencies
- Avoid feature leakage across modules

---

# 4. Dependency Rules

Allowed:
- Controller → Service
- Service → Repository
- Service → Adapter
- Repository → Database

Not Allowed:
- Repository → Service
- Controller → Repository
- Adapter → Controller
- Utils → Services (unless pure functions)
- Cross-feature imports that bypass layer boundaries

---

# 5. Error Handling Strategy

- All domain errors must originate in services.
- Controllers convert errors to HTTP responses.
- No raw stack traces returned to users.
- All errors must use structured format.

Standard Error Format:

{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-safe message",
    "correlationId": "uuid"
  }
}

Errors must:
- Avoid leaking internal implementation details
- Be logged server-side with full diagnostic info

---

# 6. Validation Strategy

- All external input validated at boundary.
- Use strict schemas.
- Reject unknown fields when possible.
- Never trust client validation.
- Services may assume validated input.

---

# 7. Authorization Strategy

- Must be enforced server-side.
- Multi-tenant systems must enforce tenant ownership in queries.
- UI visibility is NOT security.
- Authorization logic must live in services or dedicated authorization layer.

---

# 8. Configuration Rules

- All config comes from environment variables.
- No hardcoded secrets.
- App must fail fast if required config missing.
- Separate config per environment (dev/staging/prod).

---

# 9. Logging Rules

Log:
- Errors
- Security events
- Critical business actions
- Performance anomalies

Do NOT log:
- Passwords
- Tokens
- Secrets
- Full request bodies (unless sanitized)

All logs should support correlation IDs.

---

# 10. Performance & Scalability Rules

- Avoid N+1 queries.
- Index frequently queried fields.
- Use pagination on list endpoints.
- Do not load entire tables into memory.
- Avoid synchronous blocking operations in request path.
- Use async/background processing for heavy tasks.

---

# 11. Testing Expectations

- Business logic must be unit testable without framework.
- Repositories tested with integration tests.
- Security-sensitive flows must have tests.
- Adapters should be mockable.
- Tests must not depend on global state.

---

# 12. Change Control Rule for AI

When modifying architecture:
- Do not collapse layers.
- Do not move business logic into controllers.
- Do not introduce global state without justification.
- Explain architectural impact before major changes.
- Confirm no regression in security posture.

---

### IGNORE:
## How to run this architecture contract (copy/paste instruction to AI)

**Command template:**

“Using ARCHITECTURE.md, apply changes to the project.
Respect layer boundaries strictly.
Identify affected layers before coding.
Show file paths modified.
Confirm no architectural violations.
Do not collapse layers or bypass repositories.”

---