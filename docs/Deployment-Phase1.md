# Deployment Guide (Phase 1)

## Target Stack
- Backend API: Render Web Service
- Judge Worker: Render Worker Service
- ML Service: Render Python Web Service
- Frontend: Render Static Site
- Database: Supabase Postgres
- Queue: Upstash Redis
- Monitoring: Sentry + UptimeRobot + Render logs

## 1. Prepare Environment Variables

Backend/Worker required:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `ML_SERVICE_URL`
- `ENABLE_JUDGE=true`
- `STRICT_REAL_SCORING=true`
- `ADMIN_PANEL_ENABLED=true`
- `SENTRY_DSN` (optional but recommended)
- `SENTRY_ENVIRONMENT=production`
- `SENTRY_TRACES_SAMPLE_RATE=0.1`

Frontend required:
- `VITE_API_BASE_URL` (primary)
- `VITE_API_URL` (legacy fallback, optional)
- `VITE_SENTRY_DSN` (optional but recommended)
- `VITE_SENTRY_TRACES_SAMPLE_RATE=0.1`

## 2. Render Blueprint

Use `render.yaml` at repo root to create:
- `yoscore-backend`
- `yoscore-judge-worker`
- `yoscore-ml-service`
- `yoscore-frontend`

## 3. Database Migration

Run before first production cut:
```bash
cd backend
npm run migrate
```

Bootstrap first admin user:
```bash
cd backend
ADMIN_BOOTSTRAP_EMAIL=admin@example.com \
ADMIN_BOOTSTRAP_PASSWORD='replace-with-strong-password' \
ADMIN_BOOTSTRAP_NAME='YoScore Admin' \
npm run bootstrap:admin
```
PowerShell equivalent:
```powershell
cd backend
$env:ADMIN_BOOTSTRAP_EMAIL='admin@example.com'
$env:ADMIN_BOOTSTRAP_PASSWORD='replace-with-strong-password'
$env:ADMIN_BOOTSTRAP_NAME='YoScore Admin'
npm run bootstrap:admin
```

## 4. Post-Deploy Verification

1. API health: `GET /health`
2. ML health: `GET /health` on ML service
3. Admin login works and `/admin` loads
4. Challenge publish readiness is enforced
5. New submission enters queued/running/completed judge states
6. Submission score + dashboard trust score update correctly

## 5. Monitoring Setup

### Sentry
- Backend env: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`
- Frontend env: `VITE_SENTRY_DSN`, `VITE_SENTRY_TRACES_SAMPLE_RATE`

### UptimeRobot
Create checks for:
- Backend `/health`
- ML `/health`
- Frontend root URL

### Render Logs
- Keep backend and worker logs enabled.
- Alert on repeated worker failures and queue growth.

## 6. Operational Commands

```bash
cd backend
npm run backfill:scoring
npm run check:consistency
npm run test:api
```

```bash
cd frontend
npm run build
npm run test
npm run e2e
```

## 7. Rollback

If scoring pipeline degrades:
1. Pause worker deployment.
2. Keep API running to preserve reads.
3. Fix worker/runtime issue.
4. Retry failed runs from admin panel.
