# YoScore

YoScore is a 3-tier developer assessment platform focused on trusted coding evaluation in the AI era.

## Trust-Core Positioning
- AI is allowed, but must be used with understanding.
- Challenge sessions use constrained AI coaching (concept guidance, no full solutions).
- Real scoring is based on judged code execution plus proctoring behavior.
- Challenge assignment is category plus seniority aware.

## Release 1 Scope (2-day target)
- Coding-only assessments (JavaScript and Python).
- Seniority routing (Graduate 0-6, Junior 7-24, Mid 25-60, Senior 61+ months).
- Category-based randomized challenge assignment with lower-band fallback.
- Proctored timed sessions with offline-safe autosave and reconnect auto-submit.
- AI Coach (max 3 hints, concept-first, snippet-limited).
- Work-experience evidence links with risk-based verification status.
- Developer dashboard and admin operations dashboard.

## 3-Tier Architecture
- Presentation: `frontend/` (React + TypeScript + Vite)
- Process logic: `backend/` API (Express + TypeScript), judge worker (BullMQ), `ml-service/` (FastAPI)
- Data: PostgreSQL (Supabase) + Redis (Upstash)

## Repository Layout
- `frontend/` user and admin web application
- `backend/` REST API, queue integration, judge orchestration, scoring
- `ml-service/` ML proctoring analyzers
- `docs/` product and technical documentation
- `academic-submission/` academic package (Phases 1-5 + diagrams + SQL + tests)

## Prerequisites
- Node.js 20+
- npm 10+
- Python 3.11+
- Docker Desktop (for sandbox code execution)
- ffmpeg (required by `ml-service` audio pipeline)
- PostgreSQL database (Supabase recommended)
- Redis URL (Upstash recommended)

## Environment Setup
1. Copy `backend/.env.example` to `backend/.env` and fill required values.
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Install dependencies:
   - `cd backend && npm install`
   - `cd frontend && npm install`
   - `cd ml-service && python -m venv venv && .\\venv\\Scripts\\activate && pip install -r requirements.txt`
4. Ensure Docker Desktop is running.

## Run Locally (all services)
From repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-stack.ps1
```

What this starts:
- ML service on `http://127.0.0.1:5000`
- Backend API on `http://127.0.0.1:3000`
- Judge worker process
- Frontend dev server on `http://127.0.0.1:5173`

Optional:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-stack.ps1 -NoFrontend
```

## Core API Notes
- `GET /api/challenges/next?category=...` -> seniority-aware assignment
- `POST /api/proctoring/session/start` -> returns `deadline_at`, `duration_seconds`
- `POST /api/submissions` -> async judge queue; deadline + 15-minute grace enforced
- `POST /api/challenges/:challenge_id/coach-hint` -> constrained hinting (max 3)
- `GET /api/admin/work-experience/flagged` -> risk-audit queue

Full API contract: `docs/API.md`

## Scoring Model
- `challenge_score = correctness(0-40) + efficiency(0-15) + style(0-5)`
- `behavior_score = 20 - penalties` (clamped 0-20)
- `submission_score = challenge_score + behavior_score` (0-80)
- `trust_score = clamp(round(avg(graded submission_score) * 0.8 + work_experience_score), 0, 100)`

Detailed scoring: `docs/Scoring.md`

## Build and Test
Backend:

```powershell
cd backend
npm run build
npm run test:api
```

Frontend:

```powershell
cd frontend
npm run build
npm run test
```

Optional e2e:

```powershell
cd frontend
npm run e2e
```

## Deployment (Render + Supabase + Upstash)
- Render blueprint: `render.yaml`
- Backend + worker require `REDIS_URL`, database URL, JWT and scoring envs.
- Frontend requires `VITE_API_BASE_URL`.
- Observability: Sentry + UptimeRobot + Render logs.

Deployment references:
- `docs/Deployment-Phase1.md`
- `docs/RunStack.md`
- `docs/Launch-Checklist.md`

## Release 1.1+ Roadmap
Planned post-release improvements:
- Mixed assessments (MCQ, explanation, engineering scenarios)
- Automated rubric grading for non-coding items
- CV quality intelligence and role-fit guidance
- Soft-skill signal capture
- External verification adapters (GitHub/LinkedIn attestations)

## License
Academic and project use. Add your final license choice before public launch.
