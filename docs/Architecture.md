# YoScore - System Architecture Document (SAD)

## 1. Overview
YoScore uses a 3-tier client-server architecture:
- Presentation: React frontend
- Process logic: Node/Express API + judge worker + proctoring integration
- Data management: PostgreSQL + Redis queue state

This revision adds Trust-Core behavior: seniority routing, constrained AI coach, and timer/offline continuity.

## 2. Core Components

| Component | Responsibility |
|---|---|
| Frontend | Challenge UI, timer, offline autosave, AI Coach panel, dashboards |
| Backend API | Auth, challenge assignment, submission lifecycle, scoring orchestration |
| Judge Worker | Async execution of JS/Python submissions against test cases |
| Proctoring Service | Session lifecycle, violations, heartbeat, ML analysis passthrough |
| Database | Source of truth for users, challenges, submissions, runs, proctoring, work experience |
| Redis/BullMQ | Queueing and retry behavior for judge jobs |

## 3. Trust-Core Additions
- Challenge model now includes:
  - `target_seniority`
  - `duration_minutes`
- Proctoring session model now includes:
  - `deadline_at`
  - `duration_seconds`
- Work experience model now includes:
  - `evidence_links`
  - `verification_status`
  - `risk_score`
- AI Coach uses audited hint events:
  - table `ai_hint_events`
  - max 3 hints per challenge/session/user

## 4. Request/Data Flow
1. User selects category and starts a challenge.
2. Backend assigns randomized challenge by category + seniority.
3. Proctoring session starts and returns `deadline_at`.
4. User codes while frontend keeps countdown and local draft autosave.
5. Submission is queued and judged asynchronously.
6. Scoring service computes breakdown + trust updates.
7. Dashboard surfaces score, seniority, and trusted experience summary.

## 5. Offline and Deadline Flow
1. Browser goes offline during active timed session.
2. Timer continues in UI; code keeps autosaving locally.
3. If timer expires offline, editor locks and pending auto-submit is staged.
4. On reconnect, frontend auto-submits saved code.
5. Backend accepts only within 15-minute grace after deadline.

## 6. Security and Integrity
- JWT auth and role-based access control.
- Sandbox execution for judged code.
- Proctoring violations persisted with penalties.
- AI Coach prevents full-solution output by policy.
- Admin audit logs for sensitive operations.

## 7. Deployment Shape
- Frontend: Render static service
- Backend API: Render web service
- Judge worker: Render worker
- ML service: Render web service
- PostgreSQL: Supabase
- Redis: Upstash
