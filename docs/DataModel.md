# YoScore Data Model

## 1. Overview
YoScore uses PostgreSQL as the source of truth for identity, challenges, judged submissions, proctoring, and trust scoring.

Canonical schema file: `backend/db/schema.sql`

## 2. Core Entities

### 2.1 Users
Purpose: account identity and role.

Key fields:
- `id`
- `name`
- `email`
- `password`
- `role` (`developer|recruiter|admin`)
- `created_at`, `updated_at`

### 2.2 Challenges
Purpose: challenge metadata and publication state.

Key fields:
- `id`
- `title`, `description`
- `category`
- `difficulty`
- `target_seniority` (`graduate|junior|mid|senior`)
- `duration_minutes`
- `publish_status` (`draft|published|archived`)
- `created_at`, `updated_at`

### 2.3 Challenge Test and Baseline Objects
Purpose: judge correctness and efficiency references.

Tables:
- `challenge_test_cases` (name, input_data, expected_output, points, hidden flag)
- `challenge_baselines` (language, baseline_runtime_ms, baseline_memory_kb)
- `reference_docs` (allowed guidance per challenge)

### 2.4 Submissions
Purpose: user solution attempts and final components.

Key fields:
- `id`, `user_id`, `challenge_id`
- `code`
- `language` (`javascript|python|java|cpp|go|csharp`)
- `status` (`pending|graded|failed`)
- `judge_status` (`queued|running|completed|failed`)
- `judge_run_id`, `judge_error`
- score components:
  - `component_correctness`
  - `component_efficiency`
  - `component_style`
  - `component_behavior`
  - `component_work_experience`
  - `component_penalty`
- `score`, `submitted_at`, `graded_at`
- `score`, `submitted_at`

### 2.5 Submission Runs
Purpose: detailed async judge execution history.

Tables:
- `submission_runs`
  - run status, runtime, memory, stdout/stderr, summary payload
- `submission_run_tests`
  - per-test pass/fail, expected vs actual, time/memory, points

### 2.6 Proctoring
Purpose: monitor behavior during challenge attempts.

Tables:
- `proctoring_sessions`
  - `status`, `start_time`, `end_time`
  - `deadline_at`, `duration_seconds`
  - aggregated violation and penalty fields
- `proctoring_logs`
  - violation events with severity and penalty
- `ml_analysis_results`
  - raw ML service outputs
- `proctoring_settings`
  - persistent platform policy flags and thresholds

### 2.7 Work Experience and Trust
Purpose: experience-informed trust scoring with low-admin checks.

Tables:
- `work_experience`
  - `company_name`, `role`, `duration_months`
  - `evidence_links` (JSONB array)
  - `verification_status` (`pending|verified|flagged|rejected`)
  - `risk_score` (0-100)
- `trust_scores`
  - user-level aggregate (`total_score`, `trust_level`, details JSON)

### 2.8 AI Coach Audit
Purpose: enforce and audit constrained hint usage.

Table:
- `ai_hint_events`
  - `user_id`, `challenge_id`, optional `session_id`
  - `hint_index`
  - `contains_code`
  - `created_at`

### 2.9 Admin Audit
Purpose: track sensitive admin actions.

Table:
- `admin_audit_logs`
  - action, entity type/id, details payload
  - actor/target references

## 3. Relationship Summary
- User -> many Submissions
- Challenge -> many Submissions
- Submission -> many SubmissionRuns
- SubmissionRun -> many SubmissionRunTests
- User -> many ProctoringSessions
- ProctoringSession -> many ProctoringLogs
- User -> many WorkExperience rows
- User -> one TrustScores row
- Challenge -> many ChallengeTestCases, ChallengeBaselines, ReferenceDocs

## 4. Integrity and Constraints
- Enumerated checks on language, judge status, publish status, verification status.
- Numeric bounds:
  - `duration_minutes` within acceptable range
  - `risk_score` 0-100
- Foreign keys enforce user/challenge/submission references.
- Indexes optimize:
  - submission lifecycle polling
  - run/test lookups
  - challenge category plus seniority routing
  - work experience verification and risk filtering
  - proctoring deadline reads

## 5. Notes for Release 1
- Coding assessments only.
- Judge execution supports JavaScript, Python, Java, C++, Go, and C#.
- Non-coding item entities (MCQ/explanations/scenarios) are deferred to Release 1.1.
