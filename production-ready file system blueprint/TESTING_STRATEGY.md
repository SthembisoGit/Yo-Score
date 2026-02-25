# TESTING_STRATEGY.md

> Use this file as the reliability contract for the project.
> All features must include appropriate tests.
> Code without tests is incomplete.

---

## Rules of Testing Enforcement (AI MUST FOLLOW)

1. Every business logic change requires tests.
2. Security-sensitive logic must always be tested.
3. Tests must be deterministic and repeatable.
4. Tests must not depend on global state.
5. Do not remove tests unless explicitly instructed.

For each feature or change:
- ✅ Identify what type of test is required
- ✅ Add or update relevant tests
- ✅ Confirm coverage impact
- ✅ Confirm no existing tests are broken

Do NOT:
- Write superficial tests that assert nothing meaningful
- Mock everything unnecessarily
- Skip edge cases
- Depend on real external services in unit tests

---

# 1. Testing Philosophy

Testing exists to:
- Prevent regressions
- Protect architecture boundaries
- Protect security controls
- Ensure predictable behavior

Tests must validate:
- Expected behavior
- Error handling
- Edge cases
- Authorization enforcement

---

# 2. Test Types Required

## 2.1 Unit Tests

Scope:
- Services (business logic)
- Utilities (pure functions)

Must:
- Run without framework
- Run without real database
- Mock repositories and adapters

---

## 2.2 Integration Tests

Scope:
- Repository → Database
- API endpoint → Service → Repository

Must:
- Use test database
- Validate data persistence
- Validate query correctness

---

## 2.3 Security Tests

Must validate:
- Authorization enforcement
- Access control boundaries
- Rate limiting behavior
- Token/session expiration behavior
- Multi-tenant data isolation

Security tests are mandatory for:
- Auth logic
- Payment logic
- Admin features

---

## 2.4 Error Handling Tests

Must validate:
- Proper status codes returned
- Structured error format
- No raw stack traces leaked

---

# 3. Coverage Expectations

Minimum expectations:

- Services: High coverage (70–90%)
- Critical flows (auth/payments): Near 100%
- Repositories: Covered by integration tests
- Controllers: Covered indirectly via integration tests

Coverage is a guide, not a goal.
Quality of assertions matters more than percentage.

---

# 4. Test Design Standards

Tests must:

- Be isolated
- Have clear names
- Test one behavior per test
- Avoid relying on execution order
- Avoid shared mutable state

Good naming pattern:

should_create_user_when_valid_input_provided  
should_reject_payment_when_signature_invalid  
should_return_403_when_user_lacks_permission  

---

# 5. What Must Always Be Tested

For every new feature:

- Valid input
- Invalid input
- Boundary conditions
- Authorization enforcement
- Failure scenarios

For updates to existing logic:

- Ensure previous behavior still works
- Add regression tests when fixing bugs

---

# 6. Mocking Rules

Mock:
- External adapters
- Email services
- Payment providers
- Third-party APIs

Do NOT mock:
- Business logic under test
- Core service being validated

Mock only at boundaries.

---

# 7. Database Testing Rules

- Use isolated test database
- Reset database state between tests
- Avoid relying on production data
- Seed minimal required fixtures

---

# 8. Performance & Load Considerations

Performance-sensitive code must:

- Avoid N+1 queries
- Be tested with realistic dataset size when relevant
- Avoid memory leaks in long-running processes

If performance change introduced:
- Add benchmark or performance regression test where possible

---

# 9. Test Failure Policy

If tests fail:
- Do not bypass tests to make code pass
- Fix root cause
- Update tests only if behavior intentionally changed
- Document breaking changes

---

# 10. Change Control Rule for AI

When implementing features:

1. Identify impacted test types.
2. Add necessary tests before or alongside implementation.
3. Confirm:
   - No regression
   - No architectural violation
   - No security regression
4. If test coverage decreases, explain why.

---

# 11. Definition of Done (Testing)

A feature is NOT complete unless:

- Business logic tested
- Edge cases tested
- Authorization tested
- Error cases tested
- No failing tests
- No security regression

---

## How to run this testing strategy (copy/paste instruction to AI)

**Command template:**

“Using TESTING_STRATEGY.md, ARCHITECTURE.md, and CODING_STANDARDS.md,
implement: {feature/change}.
Identify required test types.
Add unit and/or integration tests where appropriate.
Confirm no regression and no coverage drop.”

---