# Frontend Workspace

This folder contains the YoScore React client, including authentication, challenge discovery,
fullscreen challenge sessions, dashboards, profiles, and admin-facing screens.

## Main areas

- `src/pages/`: route-level screens
- `src/components/`: reusable UI and challenge-session building blocks
- `src/context/`: auth and shared app state
- `src/services/`: API clients and request helpers
- `src/lib/`: formatting and calculation utilities

## Local development

```bash
cd frontend
npm install
npm run dev
```

Default local URL: `http://localhost:5173`

## Notes

- Environment variables live in `frontend/.env`
- SPA rewrites are handled by `frontend/public/_redirects` and `render.yaml`
- Build verification can be run with `npm run build`
