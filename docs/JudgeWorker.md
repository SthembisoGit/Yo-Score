# Judge Worker

## Current State

- Queue: BullMQ (`judge` queue) using `REDIS_URL`.
- Worker entry: `backend/src/worker.ts` (runtime: `npm run worker`).
- Enqueue source: `POST /api/submissions` creates pending submission and pushes `judge.run` job.
- Languages: `javascript`, `python`.
- Runner: Docker sandbox via `backend/src/services/runner.service.ts`.

## Worker Flow

1. Mark submission `judge_status=running`.
2. Validate challenge readiness (tests + language baseline).
3. Create `submission_runs` row (`running`).
4. Execute tests in sandbox.
5. Persist per-test results to `submission_run_tests`.
6. Persist run summary to `submission_runs`.
7. Finalize submission score with `ScoringService`.
8. Update trust score.

## Failure Handling

- Infrastructure failures (e.g., Docker unavailable):
  - `submission_runs.status=failed`
  - `submissions.judge_status=failed`
  - `submissions.status=failed`
  - `submissions.judge_error` populated

- User code failures:
  - run completes with failed/error tests
  - score is still computed from real outputs

## Environment

- `ENABLE_JUDGE=true`
- `REDIS_URL=<upstash/local redis>`
- Docker Desktop running

## Related APIs

- `GET /api/submissions/:submission_id/runs`
- `GET /api/submissions/:submission_id/runs/:run_id`
- `GET /api/admin/judge/health`
- `GET /api/admin/judge/runs`
- `POST /api/admin/judge/runs/:run_id/retry`
