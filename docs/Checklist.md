# YoScore MVP Development Checklist

## Step 1: Backend Foundation
- [x] `feature/data-model` - Database schema created (users, challenges, submissions, trust_scores, proctoring_logs, work_experience, reference_docs)
- [x] `feature/backend-api` - API endpoints implemented (auth, users, challenges, submissions, dashboard, proctoring, reference docs, GET /challenges/next)
- [x] `feature/auth-security` - JWT, RBAC, password hashing, token rotate, validate

## Step 2: Scoring & Proctoring
- [x] `feature/scoring-engine` - Challenge scoring and trust score calculation per docs/Scoring.md
- [x] `feature/proctoring` - Camera and browser monitoring; session linking to submission; real-time violation logging; ML-powered face/audio analysis; strict enforcement; draggable UI

## Step 3: Frontend & Dashboard
- [x] `feature/frontend-ui` - Challenge selection, code editor, submission flow; API response unwrapping; GET /submissions for user list
- [x] `feature/dashboard` - Dashboard with scores and history; completed count uses graded; trust score 0-100
- [x] `feature/reference-panel` - Reference docs via GET /challenges/:id/docs; frontend unwraps via challengeService

## Integration & Testing
- [ ] Unit tests for backend and scoring engine
- [ ] Frontend-backend integration tests

## MVP Launch
- [ ] Merge `dev` to `main`
- [ ] Tag release `v0.1-MVP`
- [ ] Deploy on test server or environment
