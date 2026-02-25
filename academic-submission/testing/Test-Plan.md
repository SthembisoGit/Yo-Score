# YoScore Test Plan

## 1. Purpose
Define the approach used to verify Outcome 7 system requirements for final academic submission.

## 2. Scope
In scope:
- authentication and authorization
- category and seniority challenge assignment
- proctored timed session behavior
- offline autosave and reconnect submit logic
- async judge lifecycle and scoring persistence
- AI Coach constraints
- work-experience evidence and risk workflow
- dashboard and admin risk-audit outputs

Out of scope:
- monthly WIL administrative forms outside the system implementation
- non-project institutional portal workflows

## 3. Test Levels
- API smoke and integration tests
- frontend unit/service tests
- end-to-end browser tests
- manual exploratory checks for device and offline behaviors

## 4. Entry Criteria
- backend/frontend dependencies installed
- database migrated using latest schema
- Redis and worker running
- ML service reachable
- required env values configured

## 5. Exit Criteria
- all high-priority test cases pass
- no open blocker defect in critical path
- evidence document updated with outcomes and timestamps

## 6. Environment
- local stack: frontend, backend API, worker, ML service, PostgreSQL, Redis
- browser: Chromium
- tooling: Node test runner, Vitest, Playwright

## 7. Risks and Mitigation
- ML service unavailable
  - mitigation: explicit degraded-mode indicator and health checks
- queue outage
  - mitigation: judge health checks and retry flow
- unstable network during timed challenge
  - mitigation: local autosave and reconnect grace policy tests

## 8. Deliverables
- `Test-Cases.md`
- `Test-Execution-Evidence.md`
- relevant logs/screenshots for failed or critical scenarios
