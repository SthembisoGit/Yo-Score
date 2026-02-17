# Phase 4: Build the Database and Demonstrate Integration

## 1. Build the Database (Data Structures)
YoScore uses PostgreSQL with schema defined in:
- `backend/db/schema.sql`

Key objects used in Trust-Core Release 1:
- Users and roles: `users`, `admin_audit_logs`
- Challenges: `challenges`, `challenge_test_cases`, `challenge_baselines`, `reference_docs`
- Submissions and judging: `submissions`, `submission_runs`, `submission_run_tests`
- Proctoring: `proctoring_sessions`, `proctoring_logs`, `ml_analysis_results`, `proctoring_settings`
- Trust and experience: `trust_scores`, `work_experience`
- AI audit: `ai_hint_events`

## 2. Manage Objects (Schema and Integrity Constraints)
Important constraints:
- `challenges.target_seniority` in (`graduate`, `junior`, `mid`, `senior`)
- `challenges.duration_minutes` bounded for safe timer limits
- `submissions.language` in (`javascript`, `python`)
- `submissions.judge_status` in (`queued`, `running`, `completed`, `failed`)
- `work_experience.verification_status` in (`pending`, `verified`, `flagged`, `rejected`)
- `work_experience.risk_score` constrained to `0-100`

Indexes support:
- challenge assignment by category and seniority
- submission lifecycle polling
- run and per-test retrieval
- proctoring session deadline checks
- work-experience risk and status filtering

## 3. Normalization Process
### 3.1 Normal Form Summary
- 1NF: atomic fields, no repeating groups.
- 2NF: non-key fields depend on full key.
- 3NF: non-key fields do not depend on other non-key fields.

### 3.2 Before vs After Example
Before (denormalized, not used):
- `assessment_blob(user_email, challenge_title, all_tests_json, total_score, trust_level)`

Problems:
- repeated values and high update anomaly risk.
- mixed granularities (user, submission, per-test, trust) in one row.

After (implemented):
- `submissions` for attempt-level records
- `submission_runs` for run-level summary
- `submission_run_tests` for per-test outcomes
- `trust_scores` for user-level aggregate
- `work_experience` for verifiable contribution data

## 4. Manipulate Data (Populate Data by Script)
Academic scripts:
- `academic-submission/sql/seed-academic-demo.sql`
- `academic-submission/sql/transactions.sql`

Seed script populates:
- sample users
- sample challenge and tests
- sample baselines and trust-related data

## 5. Manage Transactions and Queries
Transaction script demonstrates:
1. Submission creation with queued judge marker.
2. Trust score recompute transaction.
3. Role update with admin audit write.

Reporting SQL:
- `academic-submission/sql/report-queries.sql`
- `academic-submission/reports/report-queries.sql`

These queries map directly to functional requirements and admin reporting needs.

## Integration Notes
- Challenge session deadline is stored in `proctoring_sessions` and enforced at submission time.
- AI hint usage is audited in `ai_hint_events` for policy compliance.
- Work-experience entries include evidence links and risk metadata before trust contribution.
