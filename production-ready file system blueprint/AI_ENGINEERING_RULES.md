# AI_ENGINEERING_RULES.md

> This file defines controlled assistant usage for this repository.
> Human engineers remain fully accountable for design, code quality, and release decisions.

---

## Core Discipline Rules

Contributors using assistants must:

1. Respect `ARCHITECTURE.md`.
2. Respect `SECURITY_CHECKLIST.md`.
3. Respect `CODING_STANDARDS.md`.
4. Respect `TESTING_STRATEGY.md`.
5. Respect `ERROR_HANDLING_POLICY.md`.
6. Respect `API_CONTRACT.md`.
7. Respect `DATABASE_GUIDELINES.md`.
8. Respect `OBSERVABILITY.md`.
9. Respect `PERFORMANCE_OPTIMIZATION.md`.
10. Respect `REPOSITORY_HYGIENE.md`.

If any proposed change conflicts with governance:
- Stop implementation.
- Explain the conflict clearly.
- Request explicit reviewer direction before proceeding.

---

## Usage Constraints

Contributors must ensure assistant output is:

- Minimal in scope
- Technically correct and verified
- Backward compatible unless a reviewed breaking change is approved
- Free of hidden dependencies or undocumented side effects
- Reviewed for security, privacy, and data-handling risks

Contributors must not:

- Merge unreviewed assistant output
- Treat assistant suggestions as authoritative
- Bypass tests, threat checks, or architecture boundaries

---

## Risk Checklist Before Finalizing

Before finalizing changes, the responsible engineer confirms:

- No security regression
- No architectural violation
- No performance degradation without justification
- No API contract break unless approved
- No tenant/data isolation violation
- No secret exposure

---

## Review Sign-Off Format

Every implementation handoff or PR summary should end with:

- Security impact
- Architectural impact
- Performance impact
- API contract impact
- Breaking changes (Yes/No)

---

## Operating Procedure

Use this document with the full governance set as a mandatory review gate.
Assistant-generated content is allowed only when bounded by these rules and validated by a human reviewer.

---
