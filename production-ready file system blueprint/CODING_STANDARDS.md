# CODING_STANDARDS.md

> Use this file as the coding quality contract for the project.
> All code must follow these standards.
> Clarity, maintainability, and predictability are prioritized over cleverness.

---

## Rules of Coding Enforcement (AI MUST FOLLOW)

1. Follow ARCHITECTURE.md strictly.
2. Write readable, explicit code.
3. Prefer simplicity over abstraction.
4. Keep changes minimal and isolated.
5. Do not introduce new libraries without justification.
6. Do not rewrite stable code unless required.

For every change:
- ✅ Use clear naming
- ✅ Follow file size limits
- ✅ Avoid duplication
- ✅ Preserve readability
- ✅ Add/update tests when logic changes

Do NOT:
- Write overly clever one-liners
- Introduce hidden side effects
- Mix multiple responsibilities in one function
- Use magic values (use constants/config)

---

# 1. Naming Conventions

## General Rules
- Use descriptive names.
- Avoid abbreviations unless widely understood.
- Variable names must explain intent, not type.

Bad:
-data
-temp
-x
-usr

Good:
- userProfile
- paymentResult
- activeSubscriptions
- retryCount

---

## Functions / Methods

- Must describe action.
- Use verbs.
- Avoid vague names like `handle`, `process`, `doThing`.

Good:
- createUserAccount()
- validatePaymentSignature()
- calculateInvoiceTotal()

---

## Booleans

- Must read naturally.

Good:
- isActive
- hasPermission
- shouldRetry

Bad:
- activeFlag
- permissionCheck

---

# 2. File & Function Size Limits

- Max ~300–400 lines per file.
- Max ~50–70 lines per function.
- One responsibility per file.
- If a file becomes complex, extract modules.

---

# 3. Function Design Rules

Every function should:

1. Do one thing.
2. Have a clear input.
3. Have a predictable output.
4. Avoid hidden dependencies.

Avoid:
- Reading global state
- Mutating external objects silently
- Side effects unless intentional

---

# 4. Error Handling Standards

- Never swallow errors silently.
- Throw structured errors.
- Never expose internal stack traces to users.
- Do not use generic "catch-all" without logging.

---

# 5. Constants & Configuration

- No hardcoded secrets.
- No magic numbers.
- Use constants or config variables.
- Group related constants logically.

Bad:
- if (retryCount > 5)

Good:
- if (retryCount > MAX_RETRY_LIMIT)


---

# 6. Comments & Documentation

- Code should be self-explanatory.
- Comment WHY, not WHAT.
- Avoid obvious comments.

Bad:
- // increment counter
counter++

Good:
- // Prevent infinite retry loop after payment failure


---

# 7. Logging Standards

Log:
- Important state transitions
- Security-relevant events
- System failures

Do NOT log:
- Passwords
- Tokens
- Secrets
- Full raw payloads

Logs must:
- Be structured
- Support correlation IDs

---

# 8. Dependency Management

- Do not add new dependencies without justification.
- Prefer native language features when sufficient.
- Remove unused dependencies promptly.
- Avoid large libraries for small problems.

---

# 9. Duplication Policy

- Do not duplicate logic across controllers/services.
- Extract reusable logic into:
  - Utilities (pure functions)
  - Shared services
- Avoid premature abstraction.

---

# 10. Async / Concurrency Rules

- Avoid blocking operations in request lifecycle.
- Use background jobs for heavy work.
- Handle promise/future errors explicitly.
- Avoid race conditions in shared state.

---

# 11. Performance Awareness

- Avoid repeated database calls in loops.
- Cache only when necessary and safe.
- Measure before optimizing.
- Do not prematurely optimize.

---

# 12. Readability First Rule

If two implementations are functionally equal:
- Choose the more readable one.
- Choose the one easier for juniors to maintain.
- Avoid clever patterns that reduce clarity.

---

# 13. Testability Rule

All business logic must:
- Be testable without framework
- Avoid hard-coded environment dependencies
- Allow mocking of adapters/repositories

---

# 14. Change Control Rule for AI

When modifying code:
- Do not refactor unrelated sections.
- Do not rename variables unnecessarily.
- Do not change formatting style mid-file.
- Explain reasoning for structural changes.
- Confirm no regression introduced.

---

## How to run this coding standard (copy/paste instruction to AI)

**Command template:**

“Using CODING_STANDARDS.md and ARCHITECTURE.md, implement: {feature/change}.
Follow naming rules, file size limits, and error handling standards.
Do not introduce unnecessary abstractions.
Show file paths modified and confirm standards compliance.”

---

