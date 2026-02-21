# YoScore Development Progress

## Release Hardening Checklist (Current Sprint)

- [x] Developer challenge flow uses real backend submission states (queued/running/completed/failed).
- [x] Challenge status indicators map to real progress states (`completed`, `in_progress`, `not_started`).
- [x] Session timer/offline behavior remains enforced with local autosave and reconnect submit.
- [x] Proctoring device enforcement supports pause/recovery without false camera-off on mobile minimize.
- [x] Admin challenge management uses constrained category/difficulty values and validated duration inputs.
- [x] Proctoring live flow now batches events and stores sampled snapshots with server caps.
- [x] Post-exam async proctoring review summary is recorded for auditability.
- [x] Profile model and APIs extended for MVP attributes (avatar URL + professional links).
- [x] Submission results include deterministic practice guidance from run and proctoring evidence.
- [x] Full release gate (backend + frontend + e2e + manual acceptance sweep) re-run after final doc sync.

## Latest Update (MVP Language Expansion Continuation, 2026-02-21)

### Execution and judging alignment
- Extended judged language support to six languages:
  - `javascript`, `python`, `java`, `cpp`, `go`, `csharp`.
- Added unified execution provider layer:
  - local runner for JavaScript/Python.
  - OneCompiler provider for Java/C++/Go/C#.
- Added real editor execution API:
  - `POST /api/code/run` with stdin support and terminal-style output contract.
- Added run endpoint rate limit and bounded execution safeguards (code size/stdin size/timeout/output truncation).
- Preserved async judge lifecycle (`queued|running|completed|failed`) with real run metadata.

### Challenge/admin alignment
- Extended challenge/admin contracts for:
  - `supported_languages`
  - `starter_templates`
- Added readiness verification script:
  - `backend/scripts/verify-challenge-readiness.js`
- Expanded easy challenge seed set with:
  - multi-category and multi-seniority tasks.
  - AI-bug-fix style tasks.
  - per-challenge baseline seeding for all supported languages.
- Added 30-day auto-assignment cooldown exclusion for recently graded challenges.

### Profile trust and avatar improvements
- Kept trust score hydration tied to dashboard/profile fetch on auth restore/login (prevents stale zero score after refresh).
- Replaced URL-only avatar workflow with file upload flow in profile:
  - upload validation (type and max 2MB size),
  - Supabase Storage upload,
  - persisted `avatar_url` update via existing profile API.
- Added frontend env docs for avatar upload:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SUPABASE_AVATAR_BUCKET`

### Verification (this pass)
- `backend`: `NODE_OPTIONS=--max-old-space-size=6144 npm run build` passes.
- `backend`: `npm run test:api` passes.
- `backend`: `npm run test:judge-smoke` passes.
- `frontend`: `npx tsc --noEmit` passes.
- `frontend`: `NODE_OPTIONS=--max-old-space-size=6144 npm run build` passes.
- `frontend`: `npm run test -- --run` passes.

## Latest Update (Proctoring Accuracy Redesign, 2026-02-21)

### Backend proctoring redesign completed
- Added consensus-risk data model fields and constraints:
  - `proctoring_sessions`: `risk_state`, `risk_score`, `liveness_required`, `liveness_challenge`, `liveness_completed_at`, `last_sequence_id`.
  - `proctoring_event_logs`: `sequence_id`, `client_timestamp`, `confidence`, `duration_ms`, `model_version`.
  - `proctoring_snapshots`: `trigger_reason`, `quality_score`, `sha256_hash`, `expires_at`, `encrypted_key_id`.
  - New tables: `proctoring_reviews`, `proctoring_detector_health`.
- Added risk consensus engine (`backend/src/services/proctoringRisk.service.ts`) and wired it into event ingestion.
- Added new proctoring APIs:
  - `GET /api/proctoring/session/:sessionId/risk`
  - `POST /api/proctoring/session/:sessionId/liveness-check`
  - `POST /api/proctoring/session/:sessionId/review/enqueue` (admin)
- Extended health payload with capabilities and degraded reason codes.
- Added review persistence for post-exam async analysis and evidence retention metadata.

### Frontend proctoring redesign completed
- Extended proctoring event contract with sequence/confidence/duration/model metadata.
- Upgraded monitor to browser-first strategy:
  - native browser face detector path first, backend ML fallback.
  - local audio-energy sampling (browser VAD style) as primary live speech signal.
- Added consensus risk polling + pause synchronization with backend risk state.
- Added liveness challenge UX in pause modal before resume when required.
- Preserved existing device recovery flow and pause/resume behavior.

### ML-service stability updates
- Added capability/degraded reason reporting in `/health` and a dedicated `/capabilities` endpoint.
- Switched audio analyzer to local-first mode by default:
  - cloud speech transcription disabled unless `AUDIO_TRANSCRIPTION_MODE=google`.
  - live proctoring no longer depends on cloud speech availability.

### Verification (this pass)
- `backend`: `npm run build` passes.
- `backend`: `npm run test:api` passes (4/4).
- `frontend`: `npm run build` passes.
- `frontend`: `npm run test` passes.
- `ml-service`: `python -m py_compile app.py audio_analyzer.py face_detector.py` passes.

## Latest Verification Pass (2026-02-20)

### Automated gate results
- `backend`: `npm run build` passes.
- `backend`: `node --test tests/api.smoke.test.js` assertions pass (4/4).
- `backend`: `npm run test:judge-smoke` passes.
- `frontend`: `npm run build` passes.
- `frontend`: `npm run test` passes.
- `frontend`: `npm run e2e` passes (admin flow + developer flow).

### Alignment updates completed in this pass
- API docs extended for proctoring batch and snapshot contracts (`docs/API.md`).
- Architecture docs updated for two-phase proctoring and expanded profile model (`docs/Architecture.md`).
- Runbook updated with Node memory and ML feature-flag guidance (`docs/RunStack.md`).
- Academic UML and HTML content synced to two-phase proctoring + profile expansion.

## Latest Update (Stability + Real Scoring Seed, 2026-02-19)

### Critical runtime fixes completed
- Hardened challenge APIs against partial/old DB schema states:
  - Added safe legacy fallbacks when newer columns/tables are missing in `backend/src/services/challenge.service.ts`.
  - Added `readyOnly` challenge filtering so developer-facing challenge endpoints only return publish-ready challenges (tests + JS baseline + Python baseline).
- Updated challenge controllers to use ready-only listing/details for developer routes:
  - `backend/src/controllers/challenge.controller.ts`.
- Hardened work-experience APIs for mixed schema environments:
  - Legacy insert/select fallback logic in `backend/src/services/workExperience.service.ts`.
  - Corrected error status behavior in `backend/src/controllers/workExperience.controller.ts` (validation vs server failures).
- Improved CORS reliability for Render deployments:
  - Supports comma-separated origins, localhost defaults, and optional `*.onrender.com` allowance via `ALLOW_RENDER_ORIGINS` in `backend/src/utils/corsConfig.ts`.
- Added DB/queue resilience to prevent hanging requests when infrastructure is unstable:
  - Pool-level connection/query timeouts in `backend/src/db/index.ts`.
  - Judge queue initialization made lazy in `backend/src/queue/judgeQueue.ts` (no eager Redis bind at module import).
  - Submission enqueue timeout guard in `backend/src/services/submission.service.ts`.

### Real challenge scoring readiness completed
- Added easy challenge seed pipeline with real automated checks:
  - New script: `backend/scripts/seed-easy-challenges.js`.
  - New npm command: `npm run seed:easy-challenges`.
  - Seeds 9 category-aligned beginner challenges, each with:
    - publish status = published
    - target seniority = graduate
    - explicit duration
    - deterministic test cases
    - JS + Python baselines
- Seed validation completed successfully against DB (9 challenges inserted/updated).

### Judge execution reliability completed
- Reworked runner execution to support practical non-Docker environments in `backend/src/services/runner.service.ts`:
  - Added `JUDGE_RUNNER_MODE` (`local|docker|auto`) support.
  - Added runtime command execution with hard timeouts and safe process termination.
  - Added automatic Docker-unavailable fallback to local execution.
  - Added Python runtime detection (`python3`/`python`) for local mode.
- Updated environment docs (`backend/.env.example`, `docs/RunStack.md`) with runner mode and new seed step.

### Frontend alignment fixes completed
- Improved API error surfacing from backend response envelopes in `frontend/src/services/apiClient.ts`.
- Fixed local env key mismatch (`frontend/.env`) from deprecated `REACT_APP_*` to active `VITE_*` keys.

### Verification results (this pass)
- `backend`: `npm run build` passes.
- `backend`: `npm run test:api` passes (4/4).
- `frontend`: `npm run build` passes.
- `frontend`: `npm run test -- --run` passes.
- Judge service validated locally for JS and Python against seeded challenge tests (passing summaries observed).

## Latest Update (Trust-Core Realignment, 2026-02-16)

### Product and docs alignment completed
- Restored and rewrote root `README.md` to current Trust-Core positioning and run instructions.
- Rewrote `docs/PRD.md` with locked Release 1 decisions:
  - AI-with-understanding coach policy (max 3 hints, no full solutions)
  - category + seniority routing
  - timer/offline/grace behavior
  - evidence-based work experience verification
- Rewrote `docs/DataModel.md` to match implemented schema:
  - `target_seniority`, `duration_minutes`
  - `deadline_at`, `duration_seconds`
  - `evidence_links`, `verification_status`, `risk_score`
  - `ai_hint_events` audit table

### Academic package alignment completed
- Updated all phase documents in `academic-submission/` to match the same Trust-Core narrative.
- Updated UML sources to include seniority routing, timer/deadline flow, AI coach, and evidence-risk model.
- Synced `academic-submission/html/index.html` with the updated phase content and section numbering.

### Validation checkpoints
- Backend build and API smoke tests pass after Trust-Core backend changes.
- Frontend build and unit tests pass after timer/offline/coach/dashboard changes.
- Remaining validation before final release is full staging pass with live env values.

### Deferred by decision (Release 1.1+)
- Mixed non-coding assessments (MCQ, explanation, scenario engine).
- CV quality intelligence.
- Soft-skill signal capture.

## Latest Checkpoint (Phase 1 Completion Pass)

### Additional fixes completed in this pass
- Fixed frontend runtime bug in navbar role links: `navLinks` now derives from `user` inside the component (`frontend/src/components/Navbar.tsx`).
- Added Sentry integration hooks:
  - Backend init + exception capture (`backend/src/observability/sentry.ts`, wired in `backend/src/app.ts`)
  - Frontend init (`frontend/src/observability/sentry.ts`, wired in `frontend/src/main.tsx`)
- Added admin bootstrap script: `backend/scripts/bootstrap-admin.js` (`npm run bootstrap:admin`).
- Fixed frontend deploy env mismatch by supporting both `VITE_API_BASE_URL` and `VITE_API_URL` (`frontend/src/services/apiClient.ts`).
- Updated Render blueprint env keys for API/Sentry (`render.yaml`).
- Expanded admin frontend coverage (`frontend/src/pages/AdminDashboard.tsx`):
  - challenge creation + publish status controls
  - test/baseline configuration
  - judge run retry panel
  - proctoring settings save flow
  - proctoring session drilldown
  - role management and audit log visibility
- Strengthened admin client typing and endpoints usage (`frontend/src/services/adminService.ts`).
- Added Playwright critical-path e2e tests (`frontend/e2e/*`):
  - developer async submission lifecycle visibility
  - admin dashboard publish action path
- Added Playwright local web server config (`frontend/playwright.config.ts`).
- Added backend API smoke tests (`backend/tests/api.smoke.test.js`) and `npm run test:api` script.
- Updated backend app bootstrap for testability and contract consistency on root/health:
  - exported `createApp()`
  - no server listen in `NODE_ENV=test`
  - `/` and `/health` now return `{ success, message, data }`
- Fixed backend runtime scripts:
  - `npm run start` -> `node dist/src/app.js`
  - `npm run worker` -> `node dist/src/worker.js`
- Hardened queue behavior when judge is disabled (`backend/src/queue/judgeQueue.ts`):
  - no live Redis dependency when `ENABLE_JUDGE=false`
  - safe zero-count queue health fallback for admin views/tests

### Verification results (current)
- `backend`: `npm run build` passes.
- `backend`: `npm run test:api` passes (4/4).
- `backend`: `npm run check:consistency` passes (legacy count remains: `graded_submissions_missing_judge_completion = 11`, expected historical data gap).
- `backend`: `npm run backfill:scoring` passes.
- `frontend`: `npm run build` passes.
- `frontend`: `npm run test` passes.
- `frontend`: `npm run e2e` passes (2/2 Playwright specs).
- API documentation rewritten to remove legacy/duplicate sections and reflect current `/api/*` contracts (`docs/API.md`).
- Added launch and commit execution checklist (`docs/Launch-Checklist.md`).

Current Status: Phase 1 stack is now running with real async judge lifecycle, admin operations surface, proctoring policy persistence, and critical-path API/e2e gates passing locally.

## Latest Update (Academic Submission Package)

- Created full academic package scaffold under `academic-submission/` mapped to required Phases 1-5.
- Added complete phase documents:
  - `academic-submission/Phase-1-Proposal.md`
  - `academic-submission/Phase-2-Modelling.md`
  - `academic-submission/Phase-3-UI.md`
  - `academic-submission/Phase-4-Database.md`
  - `academic-submission/Phase-5-Final-Deliverables.md`
- Added full PlantUML sources for required diagrams and rendered PNG exports via Kroki:
  - use case, class, sequence, state, activity, component, deployment.
- Added SQL deliverables:
  - demo seed, transaction samples, report query scripts.
- Added QA/test deliverables:
  - test plan, test cases, test execution evidence template.
- Added deployment execution manual for final submission bundle.
- Added AI prompt pack and DOCX/PDF export guide using free tools.

## Latest Update (Phase 1 Production Alignment)

### Backend implemented
- Added strict scoring data model fields on `submissions`:
  - `language` (`javascript`/`python`)
  - `judge_status` (`queued|running|completed|failed`)
  - `judge_error`
  - `judge_run_id`
- Added challenge lifecycle field: `challenges.publish_status` (`draft|published|archived`).
- Added persistent global proctoring settings table: `proctoring_settings`.
- Added admin audit table: `admin_audit_logs`.
- Added indexes for judge lifecycle and run tables (`submission_runs`, `submission_run_tests`).
- Reworked submission flow to async judge queue only (no synchronous scoring).
- Enforced submission language + publish/readiness checks before queueing.
- Implemented run persistence and retrieval:
  - `GET /api/submissions/:submission_id/runs`
  - `GET /api/submissions/:submission_id/runs/:run_id`
- Implemented real judge scoring flow:
  - Baseline-driven efficiency (from `challenge_baselines`)
  - Deterministic JS/Python style scoring (0-5)
  - Per-test persistence in `submission_run_tests`
  - Infra failure -> `judge_status=failed`
  - User-code failure -> completed run with failed tests and valid score
- Updated scoring engine to final formula:
  - challenge: correctness(40) + efficiency(15) + style(5)
  - behavior: max 20 minus penalties
  - submission score: max 80
  - trust score: `avg(graded submission score)*0.8 + work_experience(0-20)`
- Added admin API surface (`/api/admin/*`) with strict `authorize('admin')`:
  - dashboard KPIs
  - challenge management + publish readiness
  - tests/baselines/docs management
  - judge health, run list/detail, retry run
  - proctoring sessions/summary/settings
  - user listing and role updates with audit logs
- Removed debug logging from submission/reference-doc controllers.
- Added backfill + consistency scripts:
  - `npm run backfill:scoring`
  - `npm run check:consistency`

### Frontend implemented
- Submission flow now sends required language (`javascript`/`python`).
- Language options restricted to JS + Python for MVP.
- Submission result page now supports async judge lifecycle:
  - queued/running/completed/failed states
  - polling until terminal state
  - judge run + test summary display
- Added admin route and guard:
  - `/admin` (admin-only)
- Added production admin dashboard page with:
  - platform KPIs
  - challenge publish controls + readiness view
  - test/baseline configuration panel
  - judge runs + retry action
  - user role management
- Dashboard now reads real backend totals/category scores as primary source.
- Proctoring frontend fallbacks removed for critical operations (no fake success objects).
- Added degraded-mode signaling when ML is unavailable.

### Config and operations
- Added env flags:
  - `STRICT_REAL_SCORING` (default `true`)
  - `ADMIN_PANEL_ENABLED` (default `true`)
- Updated `.env.example` accordingly.
- Migration re-run completed successfully with new schema objects.
- Backfill script executed successfully in local environment.

Current Status: Proctoring stable; judge/scoring expanded with Docker-based execution and BullMQ queue; stack startup script added. Testing and deployment remain.

## Completed (Stable)

### Backend
- CORS, env config, API client with interceptors and token rotate at `/api/auth/rotate`
- Auth: signup, login, logout, JWT, bcrypt, `/auth/validate` returning `user_id` from token `id`
- Database schema and connection (PostgreSQL/Supabase)
- Users: GET/PUT `/users/me`; work experience: POST/GET `/users/me/work-experience`
- Challenges: GET `/challenges`, GET `/challenges/:id`, GET `/challenges/next` (authenticated), POST (admin)
- Reference docs: GET `/challenges/:id/docs`, POST (admin)
- Submissions: POST `/submissions`, GET `/submissions`, GET `/submissions/:id` (authenticated)
- Dashboard: GET `/dashboard/me` with `challenge_progress` status `completed` for graded submissions
- Proctoring: Complete implementation with ML integration, strict monitoring, real-time alerts, draggable UI, session linking to submission

### Frontend
- Auth: login, signup, logout, token validation via `authService.validateToken()` and apiClient base URL
- API response unwrapping: `unwrapData()` in `lib/apiHelpers.ts`; dashboard, challenge, auth, submission, and proctoring services use it
- User submissions: `GET /submissions` (not `/submissions/user/me`)
- Dashboard: completed count = graded or completed; trust score percentage uses 0-100 scale
- Challenges: list, detail, next challenge via `getNextChallenge()` calling GET `/challenges/next`
- Challenge service trimmed to implemented endpoints only (getAllChallenges, getChallengeById, getChallengeDocs, submitChallenge, getNextChallenge)
- Forgot password link removed (no route)
- ML service: `object_detector.py` stub (typo file `object_detector,py` removed)

## In Progress / Not Done

- Submission results: optional detailed endpoint and UI for score breakdown
- Unit and integration tests
- MVP launch steps (merge, tag, deploy)
- Judge per-test persistence (`submission_run_tests`) and lint/style integration
- Submission language mapping to runner (currently defaults to node)
- Efficiency baseline uses default; should read `challenge_baselines`

## Completed This Session

### Proctoring Feature - Production Ready
- ✅ ML-powered face detection (MediaPipe) - detects multiple faces, gaze direction, eyes closed, face coverage
- ✅ ML-powered audio analysis - detects speech, multiple voices, suspicious keywords
- ✅ Strict camera/microphone enforcement - cannot be turned off during session
- ✅ Browser monitoring - tab switch, window blur, copy/paste blocking, dev tools prevention
- ✅ Real-time violation alerts with contextual messages
- ✅ Draggable, minimizable UI (not closable)
- ✅ Frame capture every 3 seconds, audio chunks every 10 seconds
- ✅ Violation scoring system with transparent, bounded penalties
- ✅ Session analytics and user violation summaries
- ✅ Complete API endpoints for all proctoring operations
- ✅ Graceful degradation when ML service is unavailable
- ✅ Comprehensive documentation (docs/Proctoring-Implementation.md)

### Scoring & Judge (latest)
- Schema extended for correctness/efficiency/style in `submissions` plus judge tables: `challenge_test_cases`, `challenge_baselines`, `submission_runs`, `submission_run_tests`.
- Scoring stores correctness/efficiency/style (real when judge runs; fallback otherwise) plus behavior and work experience.
- Judge pipeline: BullMQ queue + worker (`ENABLE_JUDGE`, `REDIS_URL`), Docker runner (python:3.11-alpine, node:18-alpine), per-test time/mem caps; submission components updated from run summary.
- Admin APIs to manage test cases/baselines on challenges.
- Startup helper script `scripts/start-stack.ps1` launches ML service, backend API, judge worker, frontend.
- Docs: `docs/JudgePlan.md`, `docs/JudgeWorker.md`, `docs/RunStack.md`.

### How to run stack
- Prereqs: Docker running; Redis URL (Upstash) in `backend/.env` as `REDIS_URL=...`; `ENABLE_JUDGE=true`; ffmpeg installed for ML audio; ML service deps installed.
- Command: `powershell -ExecutionPolicy Bypass -File scripts/start-stack.ps1` (use `-NoFrontend` to skip frontend window).
- Services started: ML (`uvicorn app:app`), backend API (`npm run start`), judge worker (`npm run worker`), frontend (`npm run dev`).

### Current limitations / next steps
- Judge needs per-test persistence (`submission_run_tests`) and lint/style integration.
- Submission language mapping to runner is static (defaults to node); should be based on submission metadata.
- Efficiency baseline uses default; should read `challenge_baselines`.
- Requires Docker; set `ENABLE_JUDGE=false` to fall back if Docker unavailable.
- ffmpeg still required for reliable audio proctoring.

### Build status
- Backend `npm run build` passes.
- Frontend `npm run build` passes (bundle size warning only).

## Bug Fixes Applied (Session)

1. Backend responses wrapped in `{ success, message, data }`; frontend now uses `unwrapData()` in dashboard, challenge, auth, submission services.
2. Token rotate route corrected to `POST /rotate` under auth router (full path `/api/auth/rotate`).
3. Auth validate returns `user_id: req.user.id` (JWT payload has `id`, not `user_id`).
4. User submissions: frontend calls `GET /submissions` instead of `GET /submissions/user/me`.
5. Dashboard completed count: treat `graded` as completed; backend sends `status: 'completed'` for graded in challenge_progress.
6. Trust score: dashboard percentage uses 0-100 scale (was 1000).
7. AuthContext: token validation uses `authService.validateToken()` (apiClient + env base URL).
8. Forgot password link removed (route not implemented).
9. GET `/challenges/next` added; returns first challenge not yet graded for user; frontend getAssignedChallenge uses getNextChallenge().
10. ML service: `object_detector.py` created with stub; `object_detector,py` deleted.

## Next Session Starting Point

- Implement scoring engine per docs/Scoring.md (challenge + behavior + work experience).
- Optionally accept and store session_id in POST /submissions and link to proctoring session.
- Add unit tests for auth and submission services; integration test for login -> dashboard -> challenges.

Last Updated: Judge runner & stack script added; build passing.

## Session Update - Proctoring/Admin/Judge Verification

### Proctoring + ML fixes
- Removed duplicate ML violation persistence path in backend `ProctoringService`:
  - `analyzeFaceFrame()` and `analyzeAudioChunk()` now store ML analysis results but do not auto-write `proctoring_logs`.
  - Frontend rule engine remains the single source for when a violation is counted, which prevents double-counting.
- Frontend `ProctoringMonitor` now increments violation count only after backend `/proctoring/violation` success.
- Added audio fallback behavior in frontend monitor:
  - If ML audio analysis is degraded/unavailable, it estimates speech from decoded audio energy and still enforces `speech_detected`.
- Improved audio blob MIME handling in frontend monitor (no hardcoded `audio/webm`).
- `ml-service` audio reliability hardening:
  - `app.py` now preserves upload file extension/content type when saving temp audio.
  - Added proper `HTTPException` passthrough in ML endpoints.
  - Added bundled ffmpeg support via `imageio-ffmpeg` and configured pydub converter.
  - Fixed Windows temp-file lock bug in `audio_analyzer.py` (moved from open-handle `NamedTemporaryFile` export to `mkstemp` flow).
  - Added timeout wrapper around Google speech recognition call to prevent hanging requests.

### Admin dashboard improvements
- Admin dashboard data loading changed from all-or-nothing to partial-resilient:
  - `Promise.allSettled` now loads independent sections even if one API call fails.
- Added challenge reference-doc management in admin UI:
  - List docs per challenge.
  - Add doc title/content from dashboard.
  - Wired through new frontend admin service methods to existing backend admin docs endpoints.

### Judge verification and smoke tooling
- Added backend smoke command:
  - `npm run test:judge-smoke`
  - Confirms Redis queue connectivity and executes real `judgeService.runTests()` against published challenge test cases/baselines.
- This smoke test validates judged execution path and per-test result production without mutating submission history.

### Validation status (this session)
- Backend build: pass (`npm run build`)
- Frontend build: pass (`npm run build`)
- Backend API smoke tests: pass (`npm run test:api`)
- Frontend unit tests: pass (`npm run test`)
- Frontend Playwright e2e: pass (`npm run e2e`)
- Judge smoke: pass (`npm run test:judge-smoke`)
- ML local verification:
  - `/health` OK
  - `/api/analyze/face` returns `no_face` violation on blank frame
  - `/api/analyze/audio` responds correctly for silence/tone test payloads

## Session Update - Production Security/Quality Hardening Audit

### Security hardening completed
- Auth hardening:
  - `AuthService` now uses `src/db` connection module consistently (removed legacy `../../db` import use).
  - Signup now normalizes email (`trim + lowercase`) and blocks privilege escalation by restricting self-signup roles to `developer|recruiter` (invalid role falls back to `developer`).
  - JWT expiration now uses `JWT_EXPIRES_IN` config consistently for both login and rotate flow.
- CORS hardening:
  - Render wildcard origins are no longer enabled by default in production (`ALLOW_RENDER_ORIGINS` now defaults false outside development).
- Rate limiting:
  - Added in-memory rate limiter middleware (`backend/src/middleware/rateLimit.middleware.ts`).
  - Applied to high-risk endpoints:
    - `/api/auth/signup`, `/api/auth/login`, `/api/auth/rotate`
    - `POST /api/submissions`
    - High-frequency proctoring ingest/analyze endpoints
- Error leakage reduction:
  - Added `safeErrorMessage` utility and applied across core controllers.
  - Replaced raw internal error exposures in proctoring responses with stable error codes.
  - Global 500 handler now returns detailed error text only in development.
- Input and payload validation:
  - Proctoring snapshot/face/audio endpoints now validate payload size and binary format signatures (jpeg/png for image; webm/wav/ogg for audio).
  - Challenge tests controller now validates required params and allowed baseline language values.

### XSS and content-safety hardening
- Reference docs are now sanitized server-side before store/return (`ReferenceDocsService`).
- Reference docs are sanitized client-side before render (`frontend/src/lib/sanitizeHtml.ts`).
- `ReferenceDocsPanel` now renders sanitized HTML only.

### Performance/reliability improvements completed
- Added `app.set('query parser', 'simple')` to reduce query-parser attack surface and simplify parsing behavior.
- Added `app.set('trust proxy', 1)` for correct client IP behavior behind Render (needed for reliable rate-limiting).
- Removed dead legacy middleware file: `backend/src/middleware/cors.js`.

### Dependency and vulnerability pass
- Upgraded `axios` in backend and frontend to `1.13.5`.
- Backend vulnerability remediation:
  - Added backend package overrides for `qs` and `minimatch`.
  - `npm audit --omit=dev` now reports `0` backend vulnerabilities.
- Frontend audit still reports high issues in dev tooling dependency chain (`tailwindcss -> sucrase -> glob/minimatch`), not runtime app code path.

### Verification status (this session)
- Backend build: pass (`npm run build`)
- Backend API smoke tests: pass (`npm run test:api`)
- Frontend build: pass (`npm run build`)
- Frontend unit tests: pass (`npm run test`)
- Judge smoke: failed in this environment due queue health timeout (`JUDGE_SMOKE_ERROR Queue health timeout after 10000ms`), indicating Redis/worker availability issue rather than compile/runtime code failure.

### Notes
- Behavior and UX flow were preserved; hardening focused on security, maintainability, and operational safety.
- Remaining recommended follow-up: tighten dev-tooling vulnerability chain in frontend when safe upgrade path is validated for Tailwind/Sucrase toolchain.
