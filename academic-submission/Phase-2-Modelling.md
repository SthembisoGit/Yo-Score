# Phase 2: Modelling with Classes

This phase models YoScore Trust-Core behavior with UML artifacts in `academic-submission/diagrams/`.

## 1. Class Diagram
- Source: `diagrams/class-diagram.puml`
- Export: `diagrams/exports/class-diagram.png`
- Includes domain entities:
  - `User`, `Challenge`, `Submission`, `SubmissionRun`, `SubmissionRunTest`
  - `ProctoringSession`, `ProctoringLog`, `ProctoringSettings`
  - `WorkExperience`, `TrustScore`
  - `ChallengeTestCase`, `ChallengeBaseline`, `ReferenceDoc`
  - `AiHintEvent`, `AdminAuditLog`
- Trust-Core fields modeled:
  - challenge `target_seniority`, `duration_minutes`
  - session `deadline_at`, `duration_seconds`
  - experience `evidence_links`, `verification_status`, `risk_score`

## 2. Sequence Diagram
- Source: `diagrams/sequence-submission-lifecycle.puml`
- Export: `diagrams/exports/sequence-submission-lifecycle.png`
- Visualizes:
  1. category + seniority challenge assignment
  2. proctoring session start with deadline metadata
  3. constrained AI Coach hint request
  4. submission queue lifecycle (`queued -> running -> completed|failed`)
  5. final dashboard refresh

## 3. State Diagram
- Source: `diagrams/state-submission-session.puml`
- Export: `diagrams/exports/state-submission-session.png`
- Submission states:
  - `pending -> queued -> running -> completed|failed`
- Session states:
  - `active <-> paused -> completed`
- Includes timer-expired and offline-reconnect behavior.

## 4. Activity Diagram
- Source: `diagrams/activity-end-to-end.puml`
- Export: `diagrams/exports/activity-end-to-end.png`
- Shows concurrent activities:
  - coding + autosave
  - proctoring monitoring
  - queue processing and scoring
  - reconnect auto-submit when applicable

## 5. Component Diagram
- Source: `diagrams/component-architecture.puml`
- Export: `diagrams/exports/component-architecture.png`
- Components:
  - Frontend (session timer, offline state, AI coach panel)
  - Backend API (assignment, submission, coach, admin endpoints)
  - Judge worker and queue
  - ML service
  - PostgreSQL and Redis
  - Monitoring stack

## 6. Deployment Diagram
- Source: `diagrams/deployment-render.puml`
- Export: `diagrams/exports/deployment-render.png`
- Deployment nodes:
  - browser clients
  - Render frontend, API, worker, ML service
  - Supabase PostgreSQL
  - Upstash Redis

## Modeling Notes
- PlantUML is used for version-controlled, reproducible diagrams.
- PNG exports are used for report submission.
- diagrams.net can be used only for final visual polishing.
