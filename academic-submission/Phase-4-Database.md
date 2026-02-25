# Phase 4: Build the Database and Demonstrate Integration

## 1. Build the Database
YoScore uses a PostgreSQL database defined in:
- `backend/db/schema.sql`

Core data structures include:
- `users`, `trust_scores`, `work_experience`,
- `challenges`, `challenge_test_cases`, `challenge_baselines`, `reference_docs`,
- `submissions`, `submission_runs`, `submission_run_tests`,
- `proctoring_sessions`, `proctoring_logs`, `proctoring_event_logs`, `proctoring_snapshots`,
- `proctoring_settings`, `ai_hint_events`, `admin_audit_logs`.

## 2. Manage Objects (Schema and Integrity Constraints)
Object management evidence includes:
- primary keys on all core tables,
- foreign key relationships for user/challenge/session/run consistency,
- check constraints for statuses and bounded fields,
- indexed columns for assignment lookup, session polling, and reporting queries.

Notable integrity controls:
- submission status lifecycle validation,
- work experience verification/risk constraints,
- challenge configuration constraints (category, level, duration),
- audit trails for admin actions and AI hint usage.

## 3. Normalization Process
### 3.1 Normalization Summary
- 1NF: atomic field storage.
- 2NF: non-key attributes depend on full keys.
- 3NF: non-key attributes are separated to avoid transitive dependency.

### 3.2 Before vs After Example
**Before (denormalized concept):**
- one table with user, challenge, test outcomes, and trust summary in the same row.

**After (implemented normalized model):**
- `submissions` (attempt records),
- `submission_runs` (run summaries),
- `submission_run_tests` (per-test results),
- `trust_scores` (aggregate trust values),
- `work_experience` (experience-specific evidence and verification).

This model removes duplication and update anomalies while improving auditability.

## 4. Manipulate Data (Populate the Database Using a Script)
Academic population scripts:
- `academic-submission/sql/seed-academic-demo.sql`
- `academic-submission/sql/transactions.sql`

These scripts demonstrate:
- seed insertion of users/challenges/test data,
- transactional creation of submission and run records,
- trust score update operations.

## 5. Manage Transaction (Transactions and Database Queries)
Transaction and query artifacts:
- `academic-submission/sql/transactions.sql`
- `academic-submission/sql/report-queries.sql`
- `academic-submission/reports/report-queries.sql`

The queries correlate with functional requirements and use cases by providing:
- challenge/result retrieval,
- trust summary extraction,
- proctoring event/violation analysis,
- judge run health and admin monitoring outputs.

## Integration Notes
- Session deadline and duration are persisted and enforced server-side.
- Submission processing and run result persistence are synchronized through queue workflows.
- Proctoring and scoring data remain linked through common session/user/submission identifiers.
