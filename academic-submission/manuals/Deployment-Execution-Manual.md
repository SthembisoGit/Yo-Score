# Deployment Execution Manual

## 1. Architecture Summary
YoScore deploys as:
- Frontend static site (Render)
- Backend API service (Render)
- Judge worker (Render worker)
- ML service (Render Python service)
- Supabase PostgreSQL
- Upstash Redis

## 2. Prerequisites
- Render account
- Supabase project with Postgres connection string
- Upstash Redis URL
- Optional Sentry DSNs

## 3. Environment Variables
### Backend + Worker
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `ML_SERVICE_URL`
- `ENABLE_JUDGE=true`
- `STRICT_REAL_SCORING=true`
- `ADMIN_PANEL_ENABLED=true`
- `SENTRY_DSN` (optional)
- `SENTRY_ENVIRONMENT=production`
- `SENTRY_TRACES_SAMPLE_RATE=0.1`

### Frontend
- `VITE_API_BASE_URL`
- `VITE_API_URL` (optional fallback)
- `VITE_SENTRY_DSN` (optional)
- `VITE_SENTRY_TRACES_SAMPLE_RATE=0.1`

## 4. Deploy Steps
1. Push repository to git remote.
2. In Render, create services manually (free plan compatible):
   - Static Site for `frontend`
   - Web Service for `backend`
   - Worker for `backend` judge worker
   - Web Service for `ml-service`
3. Set all required env vars on each service.
4. Run database migration:
   - `cd backend`
   - `npm run migrate`
5. Bootstrap admin:
   - Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`
   - Run `npm run bootstrap:admin`

## 5. Post-Deploy Validation
1. Verify backend `/health`.
2. Verify ML service `/health`.
3. Login as admin and open `/admin`.
4. Create/verify challenge tests and baselines.
5. Submit a challenge and confirm judge lifecycle updates.
6. Confirm trust score updates in dashboard.

## 6. Operational Commands
Backend:
- `npm run test:api`
- `npm run check:consistency`
- `npm run backfill:scoring`

Frontend:
- `npm run test`
- `npm run e2e`

## 7. Rollback Procedure
1. Roll back services to previous stable deployment in Render.
2. Keep DB schema as-is (non-destructive approach).
3. Restore strict flags only after incident resolution.
4. Retry failed judge runs from admin panel.
