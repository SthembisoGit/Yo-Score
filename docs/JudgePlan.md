# Automated Judge Plan (Implemented Baseline)

## Scope
- Queue: BullMQ on Redis (`judge` queue).
- Sandbox: Docker runner with no network.
- Languages: `javascript`, `python`.
- Storage:
  - `submission_runs` for run summaries
  - `submission_run_tests` for per-test outcomes
  - `challenge_test_cases` + `challenge_baselines` for scoring config

## Current Execution Flow
1. `POST /api/submissions` validates challenge publish/readiness and enqueues `judge.run`.
2. Worker marks submission `judge_status=running`.
3. Worker executes tests in Docker sandbox.
4. Worker stores per-test results and run summary.
5. Worker finalizes submission score and recomputes trust score.

## Scoring Components
- Correctness: `0-40` (weighted test points).
- Efficiency: `0-15` (runtime vs baseline runtime).
- Style: `0-5` (deterministic JS/Python static checks).
- Challenge score max: `60`.
- Behavior score max: `20`.
- Submission score max: `80`.

## Failure Policy
- Infrastructure failure (runner/docker unavailable):
  - `judge_status=failed`
  - submission marked failed with `judge_error`
- User code/runtime failure:
  - run completes with failed/error tests
  - scored from actual run output

## Admin Operations
- Health: `GET /api/admin/judge/health`
- Run list: `GET /api/admin/judge/runs`
- Run detail: `GET /api/admin/judge/runs/:run_id`
- Retry: `POST /api/admin/judge/runs/:run_id/retry`

## Remaining Enhancements
- Richer style/lint scoring (current model is deterministic MVP).
- Metrics exporter for queue/run telemetry.
- Additional languages beyond JS/Python.
