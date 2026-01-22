# YoScore MVP Development Roadmap

## 1. Branching Strategy
- `dev` → main integration branch
- Feature branches:
  - `feature/frontend-ui`
  - `feature/backend-api`
  - `feature/data-model`
  - `feature/scoring-engine`
  - `feature/proctoring`
  - `feature/dashboard`
  - `feature/reference-panel`
  - `feature/auth-security`

---

## 2. Module Development Order (MVP Priority)

### Step 1: Backend Foundation
1. `feature/data-model` → Database schema (Users, Challenges, Submissions, TrustScores, WorkExperience, ProctoringLogs, ReferenceDocs)
2. `feature/backend-api` → API endpoints for auth, challenges, submissions, work experience, reference docs
3. `feature/auth-security` → JWT authentication, RBAC, password hashing, secure endpoints

### Step 2: Scoring & Proctoring
4. `feature/scoring-engine` → Challenge scoring, trust score calculation, work experience integration
5. `feature/proctoring` → Camera monitoring, tab/browser lock, inactivity tracking, logs

### Step 3: Frontend & Dashboard
6. `feature/frontend-ui` → Challenge selection page, code editor, submission flow
7. `feature/dashboard` → Display total score, trust level, category scores, submission history
8. `feature/reference-panel` → Read-only docs/hints for each challenge

---

## 3. Integration & Testing
- PR → merge into `dev` after each feature
- Unit tests: scoring engine, API endpoints, proctoring
- Frontend-backend integration tests

---

## 4. MVP Launch
- Merge `dev` → `main`
- Tag release: `v0.1-MVP`
- Deploy on test server for early user testing

---

## 5. Notes / Tips
- Commit often to feature branches
- Document API changes in `API.md`
- Keep `Scoring.md` & `Security.md` updated
- Use mock data for frontend early testing
- MVP scoring rule-based; AI/ML can replace rules later