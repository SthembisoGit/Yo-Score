-- YoScore academic report queries (Trust-Core aligned)

-- 1) User Trust Summary Report
SELECT
  u.id AS user_id,
  u.name,
  u.email,
  u.role,
  ts.total_score,
  ts.trust_level,
  ts.updated_at
FROM users u
LEFT JOIN trust_scores ts ON ts.user_id = u.id
ORDER BY ts.total_score DESC NULLS LAST, u.created_at DESC;

-- 2) Submission Performance Report
SELECT
  s.id AS submission_id,
  u.email AS user_email,
  c.title AS challenge_title,
  c.category AS challenge_category,
  c.target_seniority AS challenge_seniority,
  s.language,
  s.score,
  s.judge_status,
  s.component_correctness,
  s.component_efficiency,
  s.component_style,
  s.component_behavior,
  s.submitted_at
FROM submissions s
JOIN users u ON u.id = s.user_id
JOIN challenges c ON c.id = s.challenge_id
ORDER BY s.submitted_at DESC;

-- 3) Proctoring Violation Report
SELECT
  ps.id AS session_id,
  u.email AS user_email,
  c.title AS challenge_title,
  pl.violation_type,
  pl.severity,
  pl.penalty,
  pl.timestamp
FROM proctoring_logs pl
JOIN proctoring_sessions ps ON ps.id = pl.session_id
LEFT JOIN users u ON u.id = ps.user_id
LEFT JOIN challenges c ON c.id = ps.challenge_id
ORDER BY pl.timestamp DESC;

-- 4) Judge Run Health Report
SELECT
  sr.id AS run_id,
  sr.submission_id,
  sr.status,
  sr.language,
  sr.test_passed,
  sr.test_total,
  sr.runtime_ms,
  sr.memory_mb,
  sr.error_message,
  sr.started_at,
  sr.finished_at
FROM submission_runs sr
ORDER BY sr.started_at DESC NULLS LAST;

-- 5) Flagged Work-Experience Audit Report
SELECT
  we.id AS experience_id,
  u.email AS user_email,
  we.company_name,
  we.role,
  we.duration_months,
  we.verification_status,
  we.risk_score,
  we.evidence_links,
  we.added_at
FROM work_experience we
JOIN users u ON u.id = we.user_id
WHERE we.verification_status = 'flagged'
   OR we.risk_score > 60
ORDER BY we.risk_score DESC, we.added_at DESC;
