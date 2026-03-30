# Backend Workspace

This folder contains the YoScore API, queue worker entry points, data-access services, and database
support scripts.

## Key areas

- `src/controllers/`: request boundary logic
- `src/routes/`: API route wiring
- `src/services/`: business logic and orchestration
- `src/queue/`: judge queue setup
- `db/`: schema and migration assets
- `scripts/`: seeding and verification helpers

## Local development

```bash
cd backend
npm install
npm run dev
```

Use `npm run build` before running the standalone worker or production start commands.
