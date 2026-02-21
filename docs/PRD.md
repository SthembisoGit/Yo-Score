# YoScore Product Requirements Document (PRD)

## 1. Product Summary
YoScore is a trusted developer assessment platform for the AI era. It is designed to evaluate whether a developer can solve problems with understanding, not just copy generated code.

Release 1 is a Trust-Core MVP focused on coding assessments only.

## 2. Problem Statement
Two major problems drive this product:
1. AI can accelerate learning, but it can also hide weak fundamentals. Many assessments cannot detect this.
2. Hiring outcomes are often noisy because evaluation quality is inconsistent and trust signals are weak.

YoScore addresses both by combining judged code execution, proctoring behavior, constrained AI guidance, and transparent score breakdowns.

## 3. Goals and Non-Goals
### 3.1 Goals (Release 1)
- Deliver category and seniority-aware challenge assignment.
- Enforce real judged scoring for six languages: JavaScript, Python, Java, C++, Go, and C#.
- Enforce timed proctored sessions with offline continuity.
- Provide constrained AI Coach (concept guidance only, max 3 hints).
- Include work-experience evidence and low-admin risk checks.
- Show trustworthy dashboard outputs for developers and admins.

### 3.2 Non-Goals (Release 1)
- Non-coding assessment engine (MCQ, explanation grading, scenario rubric scoring).
- CV analysis and soft-skill intelligence.
- Full recruiter portal.

## 4. User Personas
### 4.1 Developer
- Wants fair, skills-first assessment.
- Wants category-matched challenges and transparent feedback.
- Needs support during challenge without full code generation.

### 4.2 Admin
- Configures challenge content, tests, and baselines.
- Monitors queue, proctoring, role changes, and risky profiles.
- Needs operational visibility with auditable actions.

### 4.3 Recruiter (Limited in MVP)
- Consumes trust outcomes indirectly.
- Dedicated recruiter workflows are deferred.

## 5. Product Decisions (Locked)
- AI coach mode: concept guidance and tiny examples only.
- Hint budget: max 3 hints per challenge session.
- Seniority bands:
  - Graduate: 0-6 months
  - Junior: 7-24 months
  - Mid: 25-60 months
  - Senior: 61+ months
- Assignment policy: category filter + exact seniority first, then lower-band fallback only.
- Offline policy: timer continues offline, local autosave, lock at deadline, auto-submit on reconnect.
- Deadline grace: backend accepts reconnect submissions for 15 minutes after deadline.
- Work experience verification: evidence links + risk-based status (pending, verified, flagged, rejected).

## 6. Scope
### 6.1 In Scope (Release 1)
- Auth and role-based access.
- Challenge browsing and assignment by category/seniority.
- Proctoring session lifecycle with violations.
- Submission queue and async judge lifecycle.
- Scoring engine and trust score recomputation.
- AI Coach endpoint and UI integration.
- Developer dashboard and admin dashboard.
- Work experience risk-flag queue for admin audit.

### 6.2 Out of Scope (Post Release 1)
- Mixed assessment item types and automatic grading.
- CV intelligence and soft-skill tracking.
- Advanced anti-tamper proof-of-attempt cryptography.

## 7. Functional Requirements
- FR-01: User can sign up, log in, and log out with role-based access.
- FR-02: User can request next challenge by category.
- FR-03: Backend assigns randomized challenge by seniority policy.
- FR-04: Proctoring session start returns `deadline_at` and `duration_seconds`.
- FR-05: Frontend displays countdown timer from server deadline.
- FR-06: Frontend autosaves code locally during session.
- FR-07: If timer expires offline, editor locks and pending submit is queued locally.
- FR-08: On reconnect, frontend auto-submits latest local snapshot once.
- FR-09: Backend enforces deadline plus 15-minute grace.
- FR-10: Submission lifecycle transitions queued -> running -> completed or failed.
- FR-11: Judge persists run summary and per-test outcomes.
- FR-11a: Submission language supports `javascript|python|java|cpp|go|csharp`.
- FR-12: AI Coach returns constrained hints and rejects further hints after three requests.
- FR-13: Work experience accepts evidence links and computes risk status.
- FR-14: Trust score excludes flagged or rejected experience records.
- FR-15: Dashboard displays trust score, seniority band, and experience contribution summary.
- FR-16: Admin can view flagged experience records for audit.
- FR-17: Editor supports real code run with stdin and terminal output via `/api/code/run`.

## 8. Non-Functional Requirements
- NFR-01 Security: JWT auth, RBAC, hashed passwords, protected admin endpoints.
- NFR-02 Availability: health endpoints for API and ML service.
- NFR-03 Reliability: queue-backed async grading with persisted run records.
- NFR-04 Performance: submission API returns quickly by queueing work.
- NFR-05 Integrity: production scoring uses real judge outputs only.
- NFR-06 Observability: Sentry + uptime monitoring + service logs.
- NFR-07 Maintainability: modular service architecture and documented contracts.

## 9. Scoring and Trust Rules
- `challenge_score = correctness(0-40) + efficiency(0-15) + style(0-5)`
- `behavior_score = 20 - penalties` (clamped to 0-20)
- `submission_score = challenge_score + behavior_score` (0-80)
- `trust_score = clamp(round(avg(graded submission_score) * 0.8 + work_experience_score), 0, 100)`
- `work_experience_score = clamp(trusted_months, 0, 20)`
- Trusted months include only records with:
  - `verification_status` in (`pending`, `verified`)
  - `risk_score <= 60`

## 10. API Changes (Release 1)
- `GET /api/challenges/next?category=...`
- `POST /api/proctoring/session/start` returns deadline metadata.
- `POST /api/submissions` enforces deadline + grace when session is linked.
- `POST /api/code/run` executes code with real runtime output.
- `POST /api/challenges/:challenge_id/coach-hint` for constrained hints.
- `POST /api/users/me/work-experience` accepts `evidence_links`.
- `GET /api/dashboard/me` includes seniority and trusted-experience summary.
- `GET /api/admin/work-experience/flagged` for risk audit.

## 11. Success Metrics
- 100% of submissions use async judge lifecycle states.
- 100% of coach requests honor max 3 hints policy.
- Seniority band mapping correct at boundary values.
- Deadline/grace logic validated by acceptance tests.
- Dashboard outputs match backend scoring and trust calculations.

## 12. Release Plan
### 12.1 Release 1 (2-day target)
- Trust-Core coding flow with proctoring, judging, scoring, and dashboards.

### 12.2 Release 1.1
- Mixed assessment types (MCQ, explanation, engineering scenarios).
- Automated rubric scoring for non-coding items.

### 12.3 Release 1.2+
- CV quality assistant.
- Soft-skill signal features.
- Optional external verification adapters (GitHub, LinkedIn).
