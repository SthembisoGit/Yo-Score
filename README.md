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
- `REDIS_URL=...`
- `STRICT_REAL_SCORING=true`
- `ADMIN_PANEL_ENABLED=true`

### ML service `.env` (optional tuning)

- `ENABLE_FACE_DETECTOR=true`
- `FACE_DETECTOR_BACKEND=opencv` (default)
- `ENABLE_AUDIO_ANALYZER=false` (default on free tier)
- `ENABLE_OBJECT_DETECTOR=false` (default on free tier)

## Testing

```bash
# backend
cd backend
npm run build
npm run test:api
npm run test:judge-smoke

# frontend
cd frontend
npm run build
npm run test
npm run e2e
```

## Documentation

- Product and architecture docs: `docs/`
- Academic submission package: `academic-submission/`
