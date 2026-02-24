# YoScore

YoScore is a developer trust and skill scoring platform. It evaluates coding performance in proctored sessions, then calculates a transparent score from judged code results, behavior signals, and work experience.

## Live URLs

- Frontend: `https://yoscore-frontend.onrender.com`
- Backend API: `https://yoscore-backend.onrender.com/api`
- Backend health: `https://yoscore-backend.onrender.com/health`
- ML service: `https://yoscore-ml-service.onrender.com`
- ML health: `https://yoscore-ml-service.onrender.com/health`

## Public Demo Account

- Email: `test@yoscore.com`
- Password: `test_pass@1`
- Role: `developer`

Demo credentials are for evaluation only and may be reset.

## Product Highlights

- Seniority-aware, category-based challenge assignment
- Real async judge lifecycle (`queued`, `running`, `completed`, `failed`)
- Proctoring with enforced device checks, pause/recovery, violations, and evidence logging
- AI Coach with constrained hinting (concept guidance, limited snippets, no full solutions)
- Admin operations for challenge config, tests/baselines, docs, judge runs, and proctoring oversight
- Dashboard with real score components and trust progression

## Architecture

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + PostgreSQL
- Judge queue/worker: BullMQ + Redis
- ML service: FastAPI (lightweight live checks + degraded-mode handling)
- Deployment target: Render + Supabase + Upstash

## Local Run (Quick)

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL connection (`DATABASE_URL`)
- Redis connection (`REDIS_URL`) for judge queue
- FFmpeg available in PATH (for audio handling in ML service)

### Backend

```bash
cd backend
npm install
npm run migrate
npm run seed:build-pack
npm run seed:easy-challenges
npm run seed:verify-readiness
npm run build
npm run start
```

### Judge Worker

```bash
cd backend
npm run worker
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### ML Service

```bash
cd ml-service
pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 5000
```

## Environment Notes

### Backend `.env`

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `ML_SERVICE_URL`
- `ENABLE_JUDGE=true`
- `RUN_JUDGE_IN_API=true` (if you are not deploying a separate worker service)
- `REDIS_URL=...`
- `STRICT_REAL_SCORING=true`
- `ADMIN_PANEL_ENABLED=true`
- `ONECOMPILER_BASE_URL=https://onecompiler.com/api/v1` (for Java/C++/Go/C# run + judge)
- `ONECOMPILER_ACCESS_TOKEN=...` (or set `ONECOMPILER_API_KEY=...`)
- `ONECOMPILER_REQUEST_TIMEOUT_MS=25000`
- `CODE_EXEC_TIMEOUT_MS=15000`
- `CODE_EXEC_MAX_STDIN_BYTES=8192`
- `CODE_EXEC_MAX_CODE_BYTES=65535`
- `CODE_EXEC_MAX_OUTPUT_BYTES=32768`

Challenge content pack scripts:
- `npm run seed:build-pack` generates `backend/scripts/challenge-pack.v2.json` (50 challenges).
- `npm run seed:challenge-pack` builds and seeds the full pack.

### Frontend `.env`

- `VITE_API_BASE_URL`
- `VITE_API_URL` (optional fallback)
- `VITE_JWT_STORAGE_KEY=yoScore_auth_token`
- `VITE_SUPABASE_URL` (for avatar upload)
- `VITE_SUPABASE_ANON_KEY` (for avatar upload)
- `VITE_SUPABASE_AVATAR_BUCKET=avatars` (public bucket)

Avatar uploads use Supabase Storage directly from the frontend. Create the bucket first and set it as public for MVP/demo usage.

### ML service `.env` (optional tuning)

- `ENABLE_FACE_DETECTOR=true`
- `FACE_DETECTOR_BACKEND=opencv` (default)
- `ENABLE_AUDIO_ANALYZER=false` (default on free tier)
- `ENABLE_OBJECT_DETECTOR=false` (default on free tier)

## Render SPA Routing Note

If frontend refresh on nested routes (for example `/dashboard` or `/challenges/123`) returns `Not Found`, add a rewrite rule in the Render Static Site settings:

- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

This is also represented in `render.yaml` under the `yoscore-frontend` service routes.

## Testing

```bash
# backend
cd backend
NODE_OPTIONS=--max-old-space-size=6144 npm run build
npm run test:api
npm run test:judge-smoke

# frontend
cd frontend
NODE_OPTIONS=--max-old-space-size=6144 npm run build
npm run test
npm run e2e
```

## Documentation

- Product and architecture docs: `docs/`
- Academic submission package: `academic-submission/`
