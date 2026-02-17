-- Academic transaction examples for YoScore

-- A) Create submission + mark queued
BEGIN;

INSERT INTO submissions (
  id, user_id, challenge_id, language, code, status, judge_status
)
VALUES (
  '77777777-7777-7777-7777-777777777771',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  'javascript',
  'function solve(){ return \"0 1\"; }',
  'pending',
  'queued'
);

COMMIT;

-- B) Promote role + write audit in one transaction
BEGIN;

UPDATE users
SET role = 'admin', updated_at = NOW()
WHERE id = '22222222-2222-2222-2222-222222222222';

INSERT INTO admin_audit_logs (
  id, admin_user_id, target_user_id, action, details
)
VALUES (
  '88888888-8888-8888-8888-888888888881',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'role_update',
  '{"from":"developer","to":"admin"}'::jsonb
);

COMMIT;

-- C) Trust score update transaction after grading
BEGIN;

WITH user_avg AS (
  SELECT user_id, COALESCE(AVG(score), 0) AS avg_submission_score
  FROM submissions
  WHERE user_id = '22222222-2222-2222-2222-222222222222'
    AND status = 'graded'
  GROUP BY user_id
),
work_exp AS (
  SELECT user_id, LEAST(COALESCE(SUM(duration_months), 0), 20) AS work_score
  FROM work_experience
  WHERE user_id = '22222222-2222-2222-2222-222222222222'
  GROUP BY user_id
)
INSERT INTO trust_scores (user_id, total_score, trust_level, updated_at)
SELECT
  '22222222-2222-2222-2222-222222222222'::uuid,
  LEAST(100, ROUND(COALESCE((SELECT avg_submission_score FROM user_avg), 0) * 0.8
      + COALESCE((SELECT work_score FROM work_exp), 0)))::int AS total_score,
  CASE
    WHEN LEAST(100, ROUND(COALESCE((SELECT avg_submission_score FROM user_avg), 0) * 0.8
      + COALESCE((SELECT work_score FROM work_exp), 0))) >= 80 THEN 'High'
    WHEN LEAST(100, ROUND(COALESCE((SELECT avg_submission_score FROM user_avg), 0) * 0.8
      + COALESCE((SELECT work_score FROM work_exp), 0))) >= 55 THEN 'Medium'
    ELSE 'Low'
  END AS trust_level,
  NOW()
ON CONFLICT (user_id)
DO UPDATE SET
  total_score = EXCLUDED.total_score,
  trust_level = EXCLUDED.trust_level,
  updated_at = NOW();

COMMIT;
