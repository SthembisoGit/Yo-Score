# YoScore - Features Documentation

## 1. Overview
This document defines the Trust-Core MVP feature set and the expected behavior for each module.

## 2. Feature List

### 2.1 Developer Challenge Flow
- Category-based challenge access.
- Seniority-aware assignment (`graduate|junior|mid|senior`).
- No repeat of already graded challenges.
- Async judge lifecycle (`queued -> running -> completed|failed`).

### 2.2 Proctored Session Timer and Offline Continuity
- Session start returns `deadline_at` and `duration_seconds`.
- Live countdown in challenge UI.
- Local autosave while coding.
- Network loss does not stop timer.
- If timer expires offline, editor locks and auto-submit runs after reconnect.
- Server enforces a 15-minute reconnect grace after deadline.

### 2.3 AI Coach (Constrained)
- Endpoint-backed coaching inside challenge session.
- Max 3 hints per challenge/session/user.
- Concept-first guidance plus tiny snippets.
- Full-solution generation blocked.
- Hint requests stored in `ai_hint_events` for audit.

### 2.4 Scoring Engine
- Correctness (0-40), Efficiency (0-15), Style (0-5), Behavior (0-20).
- Submission score max: 80.
- Trust score max: 100 via weighted aggregate.
- Real judge output is source of truth.

### 2.5 Work Experience Evidence and Risk
- Users submit duration and optional `evidence_links`.
- System computes `risk_score` and `verification_status`.
- Trust contribution only uses trusted records (pending/verified and low-risk).
- Flagged/rejected records excluded from trust contribution.

### 2.6 Dashboard
- Trust score and level.
- Seniority band display.
- Work experience contribution summary.
- Category score visibility and challenge progress.

### 2.7 Admin Operations
- Challenge lifecycle and readiness checks.
- Judge run monitoring and retry actions.
- Proctoring settings and oversight.
- User role management with audit logs.
- Flagged work experience queue for low-admin review.

## 3. Future Feature Buckets (Not in this release)
- Mixed non-coding assessments (MCQ, short explanation, scenarios).
- CV quality intelligence.
- Soft-skill signal tracking and analytics.
- Expanded category taxonomy and role-track blueprints (frontend, backend, cloud, security).
