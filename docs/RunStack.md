# Run Stack (local/upstash)

Prereqs
- Redis URL (e.g., Upstash) in `backend/.env` as `REDIS_URL=...` plus `ENABLE_JUDGE=true`.
- Set feature flags in `backend/.env`:
  - `STRICT_REAL_SCORING=true`
  - `ADMIN_PANEL_ENABLED=true`
- Optional observability in `backend/.env`:
  - `SENTRY_DSN=...`
  - `SENTRY_ENVIRONMENT=development`
  - `SENTRY_TRACES_SAMPLE_RATE=0.1`
- Docker Desktop running (needed for judge sandbox).
- ML service deps (ffmpeg) installed.
- Node/npm installed; backend and frontend already `npm install`.

Apply latest schema before first run:
```
cd backend
npm run migrate
npm run bootstrap:admin
```
`bootstrap:admin` reads from env:
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_BOOTSTRAP_NAME` (optional, default `YoScore Admin`)
- `ADMIN_BOOTSTRAP_RESET_PASSWORD` (optional `true|false`, default `false`)

One-shot startup (spawns separate PowerShell windows)
```
powershell -ExecutionPolicy Bypass -File scripts/start-stack.ps1
```
- Uses `ml-service/venv/Scripts/python.exe` if it exists, else system `python`.
- Starts: ML service, backend API, judge worker, frontend (`npm run dev`).
- Pass `-NoFrontend` to skip the frontend window.

Notes
- If Docker is not running, judge jobs will fail. Start Docker Desktop first.
- Upstash Redis: keep the `rediss://...` URL/token private.
- If submissions stay `queued`, verify:
  1. `ENABLE_JUDGE=true`
  2. worker process is running (`npm run worker`)
  3. Redis connectivity

Maintenance commands:
```
cd backend
npm run backfill:scoring
npm run check:consistency
npm run test:api

cd ../frontend
npm run test
npm run e2e
```
