-- Academic demo seed script for YoScore
-- Note: adjust UUIDs/emails to match your environment if needed.

-- 1) Demo users
INSERT INTO users (id, name, email, password, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Academic Admin', 'admin.academic@example.com', '$2a$12$1Y8x1aPi6tD6j4T0Qf3pFOn1g70gWmJQ0o5qgvl2wEm7gQ7J0m2wS', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Academic Dev', 'dev.academic@example.com', '$2a$12$1Y8x1aPi6tD6j4T0Qf3pFOn1g70gWmJQ0o5qgvl2wEm7gQ7J0m2wS', 'developer')
ON CONFLICT (id) DO NOTHING;

-- 2) Demo challenge
INSERT INTO challenges (
  id,
  title,
  description,
  category,
  difficulty,
  target_seniority,
  duration_minutes,
  publish_status
)
VALUES
  (
    '33333333-3333-3333-3333-333333333333',
    'Two Sum Academic',
    'Return indexes of two numbers adding to target.',
    'backend',
    'easy',
    'junior',
    45,
    'published'
  )
ON CONFLICT (id) DO NOTHING;

-- 3) Demo test cases
INSERT INTO challenge_test_cases (id, challenge_id, name, input, expected_output, points, timeout_ms, memory_mb, order_index)
VALUES
  ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333333', 'basic-case', '2 7 11 15|9', '0 1', 1, 5000, 256, 1),
  ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333333', 'second-case', '3 2 4|6', '1 2', 1, 5000, 256, 2)
ON CONFLICT (id) DO NOTHING;

-- 4) Demo baselines
INSERT INTO challenge_baselines (id, challenge_id, language, runtime_ms, memory_mb, lint_rules)
VALUES
  ('55555555-5555-5555-5555-555555555551', '33333333-3333-3333-3333-333333333333', 'javascript', 2000, 256, '{}'::jsonb),
  ('55555555-5555-5555-5555-555555555552', '33333333-3333-3333-3333-333333333333', 'python', 2000, 256, '{}'::jsonb)
ON CONFLICT (challenge_id, language) DO NOTHING;

-- 5) Demo trust record
INSERT INTO trust_scores (id, user_id, total_score, trust_level)
VALUES
  ('66666666-6666-6666-6666-666666666661', '22222222-2222-2222-2222-222222222222', 0, 'Low')
ON CONFLICT (user_id) DO NOTHING;

-- 6) Demo work experience with evidence
INSERT INTO work_experience (
  id,
  user_id,
  company_name,
  role,
  duration_months,
  evidence_links,
  verification_status,
  risk_score
)
VALUES
  (
    '77777777-7777-7777-7777-777777777771',
    '22222222-2222-2222-2222-222222222222',
    'Academic Demo Company',
    'Junior Backend Developer',
    12,
    '["https://example.com/letter.pdf"]'::jsonb,
    'pending',
    20
  )
ON CONFLICT (id) DO NOTHING;
