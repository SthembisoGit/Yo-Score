# Phase 1 Launch Checklist and Commit Plan

## 1. Pre-Launch Checklist

## Environment
- [ ] Supabase `DATABASE_URL` configured for backend + worker.
- [ ] Upstash `REDIS_URL` configured for backend + worker.
- [ ] `JWT_SECRET` set in production.
- [ ] `ML_SERVICE_URL` set to Render ML service URL.
- [ ] `FRONTEND_URL` set to deployed frontend origin.
- [ ] Frontend API env set: `VITE_API_BASE_URL` (and optional `VITE_API_URL` fallback).
- [ ] Sentry envs set:
  - [ ] Backend: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`
  - [ ] Frontend: `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACES_SAMPLE_RATE`
- [ ] Flags:
  - [ ] `ENABLE_JUDGE=true`
  - [ ] `STRICT_REAL_SCORING=true`
  - [ ] `ADMIN_PANEL_ENABLED=true`

## Data and Schema
- [ ] Run `cd backend && npm run migrate` against production DB.
- [ ] Seed at least one admin user (bootstrap admin): `npm run bootstrap:admin` with `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD`.
- [ ] Add challenge test cases + baselines for both `javascript` and `python`.
- [ ] Publish only readiness-valid challenges.

## Runtime Services
- [ ] Render services healthy:
  - [ ] `yoscore-backend`
  - [ ] `yoscore-judge-worker`
  - [ ] `yoscore-ml-service`
  - [ ] `yoscore-frontend`
- [ ] Backend `/health` returns success.
- [ ] ML service `/health` returns success.
- [ ] Worker connected to Redis and processing jobs.

## Scoring and Proctoring Validation
- [ ] Submit a JS challenge and observe `queued -> running -> completed`.
- [ ] Submit a Python challenge and observe `queued -> running -> completed`.
- [ ] Confirm per-test rows persisted (`submission_run_tests`).
- [ ] Confirm submission breakdown fields persisted on `submissions`.
- [ ] Confirm trust score recomputes after grading and work-experience updates.
- [ ] Validate pause/resume flow for camera/mic/audio violations.
- [ ] Confirm proctoring settings persist and reflect in new sessions.

## Test Gates
- [ ] Backend: `cd backend && npm run build`
- [ ] Backend API smoke: `cd backend && npm run test:api`
- [ ] Frontend build: `cd frontend && npm run build`
- [ ] Frontend unit tests: `cd frontend && npm run test`
- [ ] Frontend e2e: `cd frontend && npm run e2e`

## Post-Migration Consistency
- [ ] Run `cd backend && npm run check:consistency`
- [ ] Run `cd backend && npm run backfill:scoring`
- [ ] Re-run `check:consistency` and verify only expected historical gaps remain.

## Monitoring
- [ ] Sentry DSN configured (backend + frontend).
- [ ] UptimeRobot checks added:
  - [ ] Backend `/health`
  - [ ] ML `/health`
  - [ ] Frontend root URL
- [ ] Alert recipients configured.

## 2. Recommended Commit Plan

Use small, reviewable commits in this order.

1. `feat(db): finalize phase1 scoring/judge/admin schema`
- Files: `backend/db/schema.sql`, config/env examples.

2. `feat(backend): async judge lifecycle and scoring finalization`
- Files: submission/judge/runner/worker/queue/scoring services, submission routes/controllers.

3. `feat(backend): admin api surface and role/audit operations`
- Files: admin controller/service/routes, user role update service, proctoring settings persistence.

4. `feat(frontend): async submission lifecycle and real score dashboards`
- Files: challenge submit flow, submission result page, dashboard wiring.

5. `feat(frontend): admin dashboard and admin service client`
- Files: admin route guard, navbar admin link, admin page, admin API client.

6. `test: add backend api smoke and frontend playwright critical paths`
- Files: `backend/tests/api.smoke.test.js`, frontend `e2e/*`, `playwright.config.ts`, package scripts.

7. `docs: update api, scoring, runstack, deployment, progress`
- Files: `docs/API.md`, `docs/Scoring.md`, `docs/RunStack.md`, `docs/Deployment-Phase1.md`, `docs/progress.md`, this file.

8. `chore: ignore generated playwright artifacts`
- Files: `.gitignore`.

## 3. Release Tag Plan
- Create release branch: `release/phase1`.
- Merge all commits after CI green.
- Tag: `v1.0.0-phase1`.
- Deploy from tag to Render.
- Observe for 48 hours with alerts enabled.

## 4. Rollback Plan
- Revert app deploy to last stable Render deploy.
- Keep DB schema (non-destructive) and disable strict flows via flags if needed:
  - `STRICT_REAL_SCORING=false` (temporary only)
  - `ADMIN_PANEL_ENABLED=false` (if admin surface incident)
- Recover judge worker and replay failed runs from admin retry endpoint.
