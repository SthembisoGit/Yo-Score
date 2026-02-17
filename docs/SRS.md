# YoScore - Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose
Define software requirements for YoScore Trust-Core MVP: a developer skill and trust assessment platform that keeps AI in the workflow while enforcing understanding and integrity.

### 1.2 Scope
In scope:
- Coding challenge assessment (JavaScript, Python)
- Proctoring and behavior-based scoring
- Seniority-aware challenge assignment by category
- AI Coach (concept hints, snippet-limited, no full solution)
- Timer and offline-resilient session continuation
- Work experience evidence capture with risk-based verification
- Dashboard and admin operations

Out of scope for this release:
- MCQ and non-coding assessment types
- CV intelligence and soft-skill analytics
- Advanced recruiter portal features

### 1.3 Definitions
- Trust score: aggregate score in range `0-100`
- Seniority band: `graduate|junior|mid|senior`
- Trusted months: experience months from eligible records only
- AI Coach: constrained helper for concepts and small examples

## 2. Overall Description

### 2.1 Product Functions
- Authenticate users and enforce RBAC
- Let developers run proctored coding sessions
- Queue and judge code asynchronously
- Compute score breakdowns and trust levels
- Assign next challenge by category and seniority
- Persist proctoring and hint audit trails
- Support admin challenge/judge/proctoring operations

### 2.2 User Classes
- Developer: solves challenges, tracks trust score
- Admin: manages challenge configuration, judge operations, proctoring policy, roles
- Recruiter (limited MVP scope): consumes trust outcomes

### 2.3 Constraints
- Browser camera and microphone permissions required for proctoring flow
- Judge execution remains sandboxed and asynchronous
- Release scope is coding-only assessment

## 3. Functional Requirements

### 3.1 Authentication
- Users can sign up, log in, log out, and validate sessions.

### 3.2 Challenge Access and Assignment
- Developers can browse published challenges.
- `GET /api/challenges/next` supports optional `category`.
- Assignment logic:
  - exact seniority band first
  - lower-band fallback only
  - randomized challenge selection
  - already graded challenges excluded

### 3.3 Seniority Bands
- Graduate: `0-6` months
- Junior: `7-24` months
- Mid: `25-60` months
- Senior: `61+` months

### 3.4 Session Timing and Offline Resilience
- Proctoring start returns `deadline_at` and `duration_seconds`.
- UI must display countdown.
- On network loss:
  - timer continues
  - code autosaves locally
- On timer expiry while offline:
  - editor locks
  - auto-submit on reconnect
- Server accepts reconnect auto-submit for 15 minutes after deadline.

### 3.5 AI Coach
- Endpoint: `POST /api/challenges/:challenge_id/coach-hint`.
- Input: `session_id`, `language`, `code`, optional `hint_index`.
- Policy:
  - max 3 hints per session/challenge/user
  - concept guidance and short snippets only
  - no full solution output
- Every hint request is auditable.

### 3.6 Work Experience Verification
- Developers submit `company_name`, `role`, `duration_months`, optional `evidence_links[]`.
- System computes:
  - `risk_score` (`0-100`)
  - `verification_status` (`pending|verified|flagged|rejected`)
- Flagged/rejected records are excluded from trust contribution.

### 3.7 Dashboard and Admin
- Dashboard includes trust score, trust level, seniority band, and experience summary.
- Admin can inspect flagged work-experience records.

## 4. Non-Functional Requirements

| Type | Requirement |
|---|---|
| Security | JWT auth, RBAC, sandboxed judge execution |
| Reliability | Queue-based judge lifecycle; deterministic score persistence |
| Performance | Core API responses target <2s excluding async judge completion |
| Availability | Health endpoints exposed for API and proctoring services |
| Maintainability | Typed service/controller boundaries and documented contracts |

## 5. Data Requirements
- Challenges include `target_seniority` and `duration_minutes`.
- Proctoring sessions include `deadline_at` and `duration_seconds`.
- Work experience includes `evidence_links`, `verification_status`, `risk_score`.
- AI coach hint events are stored with user, challenge, session, and hint index.

## 6. Scoring Requirements
- Correctness: `0-40`
- Efficiency: `0-15`
- Style: `0-5`
- Behavior: `0-20`
- `submission_score = challenge_score + behavior` (`0-80`)
- `trust_score = round(avg(graded submission_score) * 0.8 + work_experience_score)` (`0-100`)
- `work_experience_score = clamp(trusted_months, 0, 20)`
- Trusted months exclude `flagged` and `rejected` records.

## 7. Acceptance Criteria
- Category + seniority assignment returns valid randomized challenge.
- Timer/offline/reconnect auto-submit flow works end-to-end.
- Deadline + 15-minute grace enforced by backend.
- AI coach enforces 3-hint cap and blocks full-solution responses.
- Work experience stores evidence links and risk status.
- Dashboard reflects seniority and trusted experience contribution.
