# YoScore - Scoring Documentation

## 1. Overview
YoScore Phase 1 scoring is fully server-side and uses real judge output (JS/Python), proctoring penalties, and work experience.

---

## 2. Submission Score Components

| Component | Range | Source |
|---|---:|---|
| Correctness | 0-40 | Judge test-case pass points |
| Efficiency | 0-15 | Runtime vs challenge language baseline |
| Style | 0-5 | Deterministic JS/Python static checks |
| Behavior | 0-20 | Proctoring penalties applied to max 20 |

`challenge_score = correctness + efficiency + style` (max 60)  
`submission_score = challenge_score + behavior` (max 80)

---

## 3. Trust Score

Trust score is recomputed whenever:
- a submission is graded
- work experience is added/updated

Formula:

`trust_score = clamp(round(avg(all graded submission_score) * 0.8 + work_experience_score), 0, 100)`

Where:
- `avg(all graded submission_score)` is in range `0-80`
- `work_experience_score = clamp(trusted_months, 0, 20)`
- `trusted_months` only include work-experience rows where:
  - `verification_status IN ('pending', 'verified')`
  - `risk_score <= 60`
- `flagged` and `rejected` rows do not contribute to trust.

---

## 4. Behavior Penalties

Behavior starts at 20 and is reduced by:
- violation penalties from `proctoring_logs`
- pause count penalties
- pause duration penalties
- heartbeat staleness penalties

Behavior is clamped: `0-20`.

---

## 5. Trust Levels

| Score Range | Trust Level |
|---|---|
| 0-54 | Low |
| 55-79 | Medium |
| 80-100 | High |

---

## 6. Operational Rules

- Production scoring does **not** use heuristic fallback when strict scoring is enabled.
- Submissions remain pending/queued/running until judge completion.
- Judge infrastructure failures set submission `judge_status=failed`.
- User-code failures still produce a completed judge run with valid component scores.

---

## 7. Data Persistence

Submission-level fields:
- `score`
- `component_correctness`
- `component_efficiency`
- `component_style`
- `component_skill`
- `component_behavior`
- `component_work_experience`
- `component_penalty`
- `scoring_version`
- `judge_status`, `judge_error`, `judge_run_id`

Run-level fields:
- `submission_runs` (run summary)
- `submission_run_tests` (per-test outcomes)

Experience-verification fields:
- `work_experience.evidence_links`
- `work_experience.verification_status`
- `work_experience.risk_score`
