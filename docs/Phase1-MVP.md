# YoScore Phase 1 MVP

## Goal
Ship a deployable, usable MVP where a user can:
1. Sign up/log in
2. Take a proctored challenge and submit
3. See submission result and dashboard metrics
4. Update profile and add work experience

## Current MVP Status

### Done (Core Functional)
- [x] Auth flow (`/api/auth/signup`, `/api/auth/login`, `/api/auth/validate`, rotate, logout)
- [x] Challenge flow (`/api/challenges`, `/api/challenges/:id`, `/api/challenges/next`)
- [x] Submission flow (`POST /api/submissions`, `GET /api/submissions`, `GET /api/submissions/:id`)
- [x] Result page route and real backend binding (`/submissions/:id`)
- [x] Proctoring session start/end/violation logging and ML analysis endpoints
- [x] Proctoring lifecycle cleanup (listener cleanup, no mock session fallback)
- [x] Profile persistence (`GET/PUT /api/users/me`)
- [x] Work experience persistence (`GET/POST /api/users/me/work-experience`)
- [x] Backend schema alignment for proctoring + submission linking
- [x] Backend hardening baseline (`helmet`, CORS policy utility, request size limits)
- [x] Build passes for backend and frontend production bundles

### Remaining Before Production Release
- [ ] Remove/highly reduce lint debt across existing frontend codebase
- [ ] Add and pass backend + frontend test suite for critical paths
- [ ] Add production environment configs/secrets in deployment platform
- [ ] Configure production DB migrations and backup policy
- [ ] Add runtime monitoring (API error rate, ML service availability, auth failures)
- [ ] Run full UAT pass on real browsers and devices

## Release Criteria (Phase 1 Exit)
- [ ] User can complete end-to-end challenge session without manual fixes
- [ ] No blocker/high severity bugs in auth, challenge, submission, dashboard, proctoring
- [ ] Deployment pipeline can build and start backend/frontend reproducibly
- [ ] Environment variables are documented and validated
- [ ] Smoke tests executed against deployed environment

## Known Technical Debt (Non-Blocking for MVP)
- Frontend lint contains pre-existing `no-explicit-any` and component export warnings.
- Frontend bundle has a >500k chunk warning and should be split post-MVP.
- Proctoring UX still has strict behavior that may need policy tuning from real usage data.

## Delivery Estimate

### To ship a real Phase 1 MVP (from now)
- **Stabilization + bug bash:** 2-3 days
- **Test coverage for critical flows:** 2-3 days
- **Deployment + environment hardening:** 1-2 days
- **UAT + final fixes:** 1-2 days

**Total:** 6-10 working days

## Execution Order
1. Lock critical test cases (auth, submission, proctoring session lifecycle)
2. Fix high-impact lint/type hotspots in runtime-critical files first
3. Deploy backend + frontend to staging
4. Validate staging with real DB and ML service
5. Production cutover and smoke test
