# AI_ENGINEERING_RULES.md

> This file defines how AI must behave when modifying this repository.
> AI must operate under production-grade engineering discipline.

---

## Core AI Discipline Rules

AI must:

1. Respect ARCHITECTURE.md.
2. Respect SECURITY_AI_CHECKLIST.md.
3. Respect CODING_STANDARDS.md.
4. Respect TESTING_STRATEGY.md.
5. Respect ERROR_HANDLING_POLICY.md.
6. Respect API_CONTRACT.md.
7. Respect DATABASE_GUIDELINES.md.
8. Respect OBSERVABILITY.md.
9. Respect PERFORMANCE_OPTIMIZATION.md.
10. Respect REPOSITORY_HYGIENE.md.

If any change conflicts with governance:
- Stop
- Explain conflict
- Request approval

---

## AI Behavior Constraints

AI must:

- Make minimal changes
- Avoid rewriting large files unnecessarily
- Avoid renaming variables without reason
- Avoid introducing new dependencies
- Avoid breaking backward compatibility
- Always consider security implications

---

## AI Risk Checklist

Before finalizing changes, AI must confirm:

- No security regression
- No architectural violation
- No performance degradation
- No API contract break
- No tenant isolation violation
- No secret exposure

---

## Required Response Ending

Every response must end with:

✔ Security Impact  
✔ Architectural Impact  
✔ Performance Impact  
✔ API Contract Impact  
✔ Breaking Changes (Yes/No)

---

## Command Template

“Using AI_ENGINEERING_RULES.md and all governance files,
implement: {feature/change}.
Ensure full compliance with all governance documents.
Confirm no regressions across security, architecture, performance, or API stability.”

---