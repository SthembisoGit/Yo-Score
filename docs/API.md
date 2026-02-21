# YoScore API (Phase 1, Current)

## Base
- Local: `http://localhost:3000`
- API prefix: `/api/*`

## Response Contract
- Success:
```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```
- Error:
```json
{
  "success": false,
  "message": "Error message",
  "error": "ERROR_CODE"
}
```

## Auth
### `POST /api/auth/signup`
- Body: `name`, `email`, `password`, `role`

### `POST /api/auth/login`
- Body: `email`, `password`
- Returns token + user identity.

### `POST /api/auth/logout`
- Auth required.

### `POST /api/auth/rotate`
- Requires bearer token.
- Returns rotated token in `data.token`.

### `GET /api/auth/validate`
- Auth required.
- Returns `data.valid` and user profile when valid.

## Users
### `GET /api/users/me`
- Auth required.
- Returns extended profile fields:
  - `avatar_url`
  - `headline`
  - `bio`
  - `location`
  - `github_url`
  - `linkedin_url`
  - `portfolio_url`

### `PUT /api/users/me`
- Auth required.
- Update profile fields.

### `POST /api/users/me/work-experience`
- Auth required.
- Body: `company_name`, `role`, `duration_months`, optional `evidence_links` (string array).
- Server computes:
  - `verification_status` (`pending|verified|flagged|rejected`)
  - `risk_score` (`0-100`)
  - legacy `verified` is no longer user-controlled.

### `GET /api/users/me/work-experience`
- Auth required.

## Dashboard
### `GET /api/dashboard/me`
- Auth required.
- Returns trust score, trust level, seniority, experience summary, category aggregates, challenge progress, submission stats.
- Added fields:
  - `seniority_band` (`graduate|junior|mid|senior`)
  - `work_experience_score` (`0-20`)
  - `work_experience_summary` (`trusted_months`, `total_entries`, `flagged_entries`)

## Challenges
### `GET /api/challenges`
- Public.
- Returns published challenges for developer flow.

### `GET /api/challenges/next`
- Auth required.
- Optional query: `category`.
- Returns randomized next challenge for current user by:
  - selected category,
  - exact seniority band first,
  - then lower-band fallback only.

### `GET /api/challenges/:challenge_id`
- Public.

### `GET /api/challenges/:challenge_id/docs`
- Public.

### `POST /api/challenges`
- Admin only.
- Supports:
  - `target_seniority`
  - `duration_minutes`
  - `supported_languages` (`javascript|python|java|cpp|go|csharp`)
  - `starter_templates` (per-language starter code object)

### `POST /api/challenges/:challenge_id/coach-hint`
- Auth required.
- Body: `session_id`, `language`, `code`, optional `hint_index`.
- Policy:
  - max 3 hints per session/challenge/user
  - concept-first guidance
  - small snippet examples only
  - full-solution output blocked
- Response fields:
  - `hint_index`
  - `remaining_hints`
  - `hint`
  - `snippet`
  - `policy`

### `POST /api/challenges/:challenge_id/docs`
- Admin only.

### `GET /api/challenges/:challenge_id/tests`
- Admin only.

### `POST /api/challenges/:challenge_id/tests`
- Admin only.

### `PUT /api/challenges/:challenge_id/tests/:test_id`
- Admin only.

### `DELETE /api/challenges/:challenge_id/tests/:test_id`
- Admin only.

### `GET /api/challenges/:challenge_id/baseline?language=javascript|python|java|cpp|go|csharp`
- Admin only.

### `PUT /api/challenges/:challenge_id/baseline`
- Admin only.

## Code Run (Editor Terminal)
### `POST /api/code/run`
- Auth required.
- Rate limited.
- Body:
```json
{
  "language": "java",
  "code": "public class Main { public static void main(String[] args){ System.out.println(\"ok\"); } }",
  "stdin": "",
  "challenge_id": "optional-uuid"
}
```
- Returns:
```json
{
  "success": true,
  "message": "Code executed",
  "data": {
    "language": "java",
    "stdout": "ok\n",
    "stderr": "",
    "exit_code": 0,
    "timed_out": false,
    "runtime_ms": 221,
    "memory_kb": 0,
    "truncated": false,
    "provider": "onecompiler",
    "error_class": null
  }
}
```
- Providers:
  - `local` for `javascript|python`
  - `onecompiler` for `java|cpp|go|csharp`

## Submissions (Async Judge Lifecycle)
### `POST /api/submissions`
- Auth required.
- Body:
```json
{
  "challenge_id": "uuid",
  "language": "javascript|python|java|cpp|go|csharp",
  "code": "function solve(input) { return input; }",
  "session_id": "optional-proctoring-session-id"
}
```
- Time enforcement:
  - if `session_id` has a challenge deadline, submission is accepted until deadline + 15 minutes reconnect grace.
  - after grace window, API rejects with deadline exceeded error.
- Returns queued submission:
```json
{
  "success": true,
  "message": "Submission received",
  "data": {
    "submission_id": "uuid",
    "status": "pending",
    "judge_status": "queued",
    "message": "Submission received and queued for scoring"
  }
}
```

### `GET /api/submissions`
- Auth required.
- Returns current user submissions.

### `GET /api/submissions/:submission_id`
- Auth required.
- Returns judge lifecycle, score breakdown, penalty info, run summary, tests summary, trust totals.
- Includes `practice_feedback` array generated from:
  - failed tests,
  - score components,
  - proctoring violations.

### `GET /api/submissions/:submission_id/runs`
- Auth required.
- Returns historical judge runs for the submission.

### `GET /api/submissions/:submission_id/runs/:run_id`
- Auth required.
- Returns run detail with per-test outcomes.

## Proctoring
All proctoring routes require auth.

### Health
- `GET /api/proctoring/health`

### Session lifecycle
- `POST /api/proctoring/session/start`
- `POST /api/proctoring/session/end`
- `POST /api/proctoring/session/pause`
- `POST /api/proctoring/session/resume`
- `POST /api/proctoring/session/heartbeat`
- `GET /api/proctoring/session/:sessionId`
- `GET /api/proctoring/session/:sessionId/analytics`
- `GET /api/proctoring/session/:sessionId/status`
- `GET /api/proctoring/session/:sessionId/risk`
- `POST /api/proctoring/session/:sessionId/liveness-check`
- `POST /api/proctoring/session/:sessionId/review/enqueue` (admin only)
- `POST /api/proctoring/session/start` response includes:
  - `sessionId`
  - `deadline_at`
  - `duration_seconds`
- `POST /api/proctoring/events/batch`
  - Body: `session_id`, optional `sequence_start`, `events[]` with:
    - `event_type`, `severity`
    - optional `payload`, `timestamp`
    - optional `confidence`, `duration_ms`, `sequence_id`, `client_ts`, `model_version`
  - Used for lightweight live-event buffering.
  - Response includes accepted count, bounded queue status, and consensus risk output.
- `POST /api/proctoring/session/:sessionId/snapshot`
  - Binary JPEG/PNG body with optional metadata header:
    - `X-Proctoring-Metadata` JSON (trigger reason, risk state, quality score)
  - Server stores bounded snapshots per session and may reject oversized uploads.
  - Intended for trigger-based or sampled evidence only (not continuous upload).
  - Stored evidence includes retention expiry metadata for automatic purge.

### Violations
- `POST /api/proctoring/violation`
- `POST /api/proctoring/violations/batch`

### User/session views
- `GET /api/proctoring/user/:userId/sessions`
- `GET /api/proctoring/user/:userId/violations/summary`

### Settings
- `GET /api/proctoring/settings`
- `PUT /api/proctoring/settings` (admin only)

### ML analysis passthrough
- `POST /api/proctoring/analyze-face` (binary image body)
- `POST /api/proctoring/analyze-audio` (binary audio body)

## Admin API
Admin routes are under `/api/admin/*`.

Requirements:
- Authenticated user
- `admin` role
- `ADMIN_PANEL_ENABLED=true`

### Dashboard
- `GET /api/admin/dashboard`

### Challenge operations
- `GET /api/admin/challenges`
- `POST /api/admin/challenges`
- `PUT /api/admin/challenges/:challenge_id`
- `PUT /api/admin/challenges/:challenge_id/publish`
- `GET /api/admin/challenges/:challenge_id/readiness`

### Judge content config
- `GET /api/admin/challenges/:challenge_id/tests`
- `POST /api/admin/challenges/:challenge_id/tests`
- `PUT /api/admin/challenges/:challenge_id/tests/:test_id`
- `DELETE /api/admin/challenges/:challenge_id/tests/:test_id`
- `GET /api/admin/challenges/:challenge_id/baseline`
- `PUT /api/admin/challenges/:challenge_id/baseline`
- `GET /api/admin/challenges/:challenge_id/docs`
- `POST /api/admin/challenges/:challenge_id/docs`

### Judge operations
- `GET /api/admin/judge/health`
- `GET /api/admin/judge/runs`
- `GET /api/admin/judge/runs/:run_id`
- `POST /api/admin/judge/runs/:run_id/retry`

### Proctoring oversight
- `GET /api/admin/proctoring/sessions`
- `GET /api/admin/proctoring/summary`
- `GET /api/admin/proctoring/sessions/:session_id`
- `GET /api/admin/proctoring/settings`
- `PUT /api/admin/proctoring/settings`

### Roles and audit
- `GET /api/admin/users`
- `PUT /api/admin/users/:user_id/role`
- `GET /api/admin/audit-logs`
- `GET /api/admin/work-experience/flagged`
