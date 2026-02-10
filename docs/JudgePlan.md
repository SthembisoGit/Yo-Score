# Automated Judge & Scoring Expansion (MVP+)

## Defaults (all free-friendly)
- Sandbox: Docker (rootless possible), outbound network disabled.
- Queue: BullMQ on Redis.
- Languages (phase 1): Python 3.x, Node.js 18.x.
- Tests store: DB rows (challenge_test_cases) + optional small fixtures (bytea); larger fixtures can move to object storage later.
- Efficiency baseline: per-challenge fixed target_runtime_ms and memory_limit_mb.
- Linters/AST checks: lightweight language-specific (eslint --no-eslintrc with minimal rules; flake8 with built-ins).
- Artifacts: stdout/stderr limited to 32 KB each, stored in DB (bytea).
- Limits: 5s CPU/time, 256 MB memory per run, max 3 retries with backoff.
- Feature flag: ENABLE_JUDGE=true.
- Observability: Prometheus metrics + structured logs; alert on queue lag, job failures, sandbox errors.

## Data Model Additions
- `challenge_test_cases`(id, challenge_id, name, input, expected_output, is_hidden, points, timeout_ms, memory_mb, order_index).
- `challenge_baselines`(challenge_id, language, runtime_ms, memory_mb, lint_rules JSONB, updated_at).
- `submission_runs`(id, submission_id, language, status, score_correctness, score_efficiency, score_style, started_at, finished_at, runtime_ms, memory_mb, test_passed, test_total, stdout, stderr, sandbox_exit_code, error_message).
- `submission_run_tests`(id, submission_run_id, test_case_id, status, runtime_ms, output, error, points_awarded).

## API Additions
- Admin: POST/PUT/DELETE `/api/challenges/:id/tests` (manage test cases), `/api/challenges/:id/baseline`.
- Worker status: GET `/api/judge/health` (queue + sandbox).
- Submission runs: GET `/api/submissions/:id/runs` (summary), GET `/api/submissions/:id/runs/:runId` (detail).

## Queue + Worker Flow
1) `POST /api/submissions` enqueues `judge.run` job with submission_id, language, code.
2) Worker pulls job, prepares sandbox, writes code file, runs tests serially or sharded per language image.
3) Collects per-test results; computes correctness (points earned / total), efficiency (runtime vs baseline), style (lint score).
4) Persists `submission_runs` + `submission_run_tests`; updates `submissions.score` components via ScoringService.
5) Emits metrics: job_latency, run_time, test_pass_rate, failures, sandbox_exit_code counts.

## Scoring Changes (Server)
- Add Challenge Performance components:
  - Correctness: weighted test points.
  - Efficiency: scored 0–20 via runtime_ratio = min(2.0, actual/baseline); efficiency = clamp(20 * (2 - runtime_ratio), 0, 20).
  - Style: 0–10 from lint/AST signals (e.g., warnings <=1 =>10, <=3 =>7, else 3, syntax error =>0).
  - Total challenge performance max 60; keep behavior/work-experience as-is.
- Store components in submissions: component_correctness, component_efficiency, component_style (add columns).

## Reliability / Safety
- Sandbox: no network, readonly rootfs, bind-mount temp workspace, drop privileges, cap CPU/mem, kill on timeout.
- Retries: retry on infrastructure errors (timeout, sandbox init); no retry on user code compile/runtime errors.
- Timeouts: test-level timeout_ms, run-level 5s default.
- Logging: capture stderr/stdout per test capped to 32 KB.

## Rollout Phases
1) Schema + API scaffolding; feature-flag off.
2) Worker minimal path for Python + Node; visible only to admins.
3) Enable for selected challenges; compare heuristic vs judge scoring.
4) Default ON for all challenges; keep heuristics as fallback if worker fails (graceful degrade).

## Open Items (to clarify later if needed)
- Object storage for large fixtures/artifacts.
- Additional languages (Java/C++) once baseline images ready.
- Plagiarism/duplication checks (future).
