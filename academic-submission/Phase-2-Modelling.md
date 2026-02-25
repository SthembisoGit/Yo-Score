# Phase 2: Modelling with Classes

All Phase 2 outputs are provided as PlantUML source and PNG exports under `academic-submission/diagrams/`.

## 1. Class Diagrams
- Source: `academic-submission/diagrams/class-diagram.puml`
- Export: `academic-submission/diagrams/exports/class-diagram.png`
- Main classes/entities modeled:
  - `User`, `Challenge`, `ChallengeTestCase`, `ChallengeBaseline`, `ReferenceDoc`
  - `Submission`, `SubmissionRun`, `SubmissionRunTest`
  - `ProctoringSession`, `ProctoringLog`, `ProctoringEventLog`, `ProctoringSnapshot`, `ProctoringSettings`
  - `WorkExperience`, `TrustScore`, `AiHintEvent`, `AdminAuditLog`

## 2. Sequence Diagram
- Source: `academic-submission/diagrams/sequence-submission-lifecycle.puml`
- Export: `academic-submission/diagrams/exports/sequence-submission-lifecycle.png`
- Visualized flow:
1. challenge request and assignment,
2. proctoring session initialization,
3. coding and helper usage,
4. submission queue processing,
5. result persistence and dashboard update.

## 3. State Diagrams
- Source: `academic-submission/diagrams/state-submission-session.puml`
- Export: `academic-submission/diagrams/exports/state-submission-session.png`
- States modeled:
  - submission lifecycle (`pending -> queued -> running -> completed|failed`),
  - session lifecycle (`active <-> paused -> completed`).

## 4. Activity Diagrams
- Source: `academic-submission/diagrams/activity-end-to-end.puml`
- Export: `academic-submission/diagrams/exports/activity-end-to-end.png`
- Activities represented:
  - challenge solving flow,
  - proctoring monitoring activities,
  - asynchronous judging and score publication,
  - concurrent event capture and persistence.

## 5. Component Diagrams
- Source: `academic-submission/diagrams/component-architecture.puml`
- Export: `academic-submission/diagrams/exports/component-architecture.png`
- Components represented:
  - frontend web client,
  - backend API services,
  - judge/queue processing,
  - proctoring service,
  - PostgreSQL and Redis data services.

## 6. Deployment Diagram
- Source: `academic-submission/diagrams/deployment-render.puml`
- Export: `academic-submission/diagrams/exports/deployment-render.png`
- Deployment environment represented:
  - browser clients,
  - hosted frontend/backend/proctoring services,
  - cloud database and queue infrastructure.

## Modeling Notes
- Diagrams are traceable to functional requirements and use cases in Phase 1.
- PlantUML source files are version controlled for reproducibility.
- PNG exports are included for insertion into the final single PDF.
