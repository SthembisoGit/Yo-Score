CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'developer',
    avatar_url TEXT,
    headline VARCHAR(255),
    bio TEXT,
    location VARCHAR(255),
    github_url TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
    target_seniority VARCHAR(20) NOT NULL DEFAULT 'junior',
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    publish_status VARCHAR(20) NOT NULL DEFAULT 'published',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proctoring_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    submission_id UUID,
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    total_violations INTEGER DEFAULT 0,
    total_penalty INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    deadline_at TIMESTAMP,
    duration_seconds INTEGER,
    paused_at TIMESTAMP,
    pause_reason TEXT,
    heartbeat_at TIMESTAMP,
    pause_count INTEGER DEFAULT 0,
    total_paused_seconds INTEGER DEFAULT 0,
    risk_state VARCHAR(20) DEFAULT 'observe',
    risk_score INTEGER DEFAULT 0,
    liveness_required BOOLEAN DEFAULT false,
    liveness_challenge JSONB DEFAULT '{}'::jsonb,
    liveness_completed_at TIMESTAMP,
    last_sequence_id BIGINT DEFAULT 0,
    privacy_consent_at TIMESTAMP,
    privacy_policy_version VARCHAR(40),
    privacy_notice_locale VARCHAR(16),
    privacy_ip_hash VARCHAR(64),
    privacy_user_agent TEXT,
    privacy_consent_scope JSONB DEFAULT '[]'::jsonb,
    evidence_retention_days INTEGER DEFAULT 7
);

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    session_id UUID REFERENCES proctoring_sessions(id) ON DELETE SET NULL,
    language VARCHAR(20) NOT NULL DEFAULT 'javascript',
    code TEXT NOT NULL,
    score INTEGER,
    judge_status VARCHAR(20) NOT NULL DEFAULT 'queued',
    judge_error TEXT,
    component_correctness INTEGER,
    component_efficiency INTEGER,
    component_style INTEGER,
    component_skill INTEGER,
    component_behavior INTEGER,
    component_work_experience INTEGER,
    component_penalty INTEGER DEFAULT 0,
    scoring_version VARCHAR(20),
    judge_run_id UUID,
    status VARCHAR(50) DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trust_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_score INTEGER DEFAULT 0,
    trust_level VARCHAR(50) DEFAULT 'Low',
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proctoring_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'low',
    description TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    penalty INTEGER DEFAULT 0,
    confidence FLOAT DEFAULT 1.0,
    evidence_data JSONB
);

CREATE TABLE IF NOT EXISTS ml_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    results JSONB NOT NULL DEFAULT '{}'::jsonb,
    violations_detected INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proctoring_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    require_camera BOOLEAN NOT NULL DEFAULT true,
    require_microphone BOOLEAN NOT NULL DEFAULT true,
    require_audio BOOLEAN NOT NULL DEFAULT true,
    strict_mode BOOLEAN NOT NULL DEFAULT false,
    allowed_violations_before_warning INTEGER NOT NULL DEFAULT 3,
    auto_pause_on_violation BOOLEAN NOT NULL DEFAULT false,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_experience (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    duration_months INTEGER NOT NULL,
    verified BOOLEAN DEFAULT false,
    evidence_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    risk_score INTEGER NOT NULL DEFAULT 0,
    added_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reference_docs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_hint_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES proctoring_sessions(id) ON DELETE SET NULL,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    hint_index INTEGER NOT NULL,
    contains_code BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES proctoring_sessions(id) ON DELETE SET NULL;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS language VARCHAR(20) NOT NULL DEFAULT 'javascript';

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS judge_status VARCHAR(20) NOT NULL DEFAULT 'queued';

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS judge_error TEXT;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS component_correctness INTEGER;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS component_efficiency INTEGER;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS component_style INTEGER;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS component_skill INTEGER;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS component_behavior INTEGER;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS component_work_experience INTEGER;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS component_penalty INTEGER DEFAULT 0;

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS scoring_version VARCHAR(20);

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS judge_run_id UUID;

-- Judge-related tables
CREATE TABLE IF NOT EXISTS challenge_test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    input TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden BOOLEAN DEFAULT false,
    points INTEGER DEFAULT 1,
    timeout_ms INTEGER DEFAULT 5000,
    memory_mb INTEGER DEFAULT 256,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_baselines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    runtime_ms INTEGER DEFAULT 5000,
    memory_mb INTEGER DEFAULT 256,
    lint_rules JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(challenge_id, language)
);

CREATE TABLE IF NOT EXISTS submission_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    score_correctness INTEGER DEFAULT 0,
    score_efficiency INTEGER DEFAULT 0,
    score_style INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    runtime_ms INTEGER,
    memory_mb INTEGER,
    test_passed INTEGER DEFAULT 0,
    test_total INTEGER DEFAULT 0,
    stdout BYTEA,
    stderr BYTEA,
    sandbox_exit_code INTEGER,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS submission_run_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_run_id UUID REFERENCES submission_runs(id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES challenge_test_cases(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    runtime_ms INTEGER,
    output TEXT,
    error TEXT,
    points_awarded INTEGER DEFAULT 0
);

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS pause_reason TEXT;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMP;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS pause_count INTEGER DEFAULT 0;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS total_paused_seconds INTEGER DEFAULT 0;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS risk_state VARCHAR(20) DEFAULT 'observe';

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS liveness_required BOOLEAN DEFAULT false;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS liveness_challenge JSONB DEFAULT '{}'::jsonb;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS liveness_completed_at TIMESTAMP;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS last_sequence_id BIGINT DEFAULT 0;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMP;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS privacy_policy_version VARCHAR(40);

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS privacy_notice_locale VARCHAR(16);

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS privacy_ip_hash VARCHAR(64);

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS privacy_user_agent TEXT;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS privacy_consent_scope JSONB DEFAULT '[]'::jsonb;

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS evidence_retention_days INTEGER DEFAULT 7;

ALTER TABLE proctoring_logs
    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE;

ALTER TABLE proctoring_logs
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE proctoring_logs
    ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'low';

ALTER TABLE proctoring_logs
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE proctoring_logs
    ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 1.0;

ALTER TABLE proctoring_logs
    ADD COLUMN IF NOT EXISTS evidence_data JSONB;

ALTER TABLE challenges
    ADD COLUMN IF NOT EXISTS target_seniority VARCHAR(20) NOT NULL DEFAULT 'junior';

ALTER TABLE challenges
    ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 45;

ALTER TABLE challenges
    ADD COLUMN IF NOT EXISTS publish_status VARCHAR(20) NOT NULL DEFAULT 'published';

ALTER TABLE challenges
    DROP CONSTRAINT IF EXISTS challenges_publish_status_chk;

ALTER TABLE challenges
    ADD CONSTRAINT challenges_publish_status_chk
    CHECK (publish_status IN ('draft', 'published', 'archived'));

ALTER TABLE challenges
    DROP CONSTRAINT IF EXISTS challenges_target_seniority_chk;

ALTER TABLE challenges
    ADD CONSTRAINT challenges_target_seniority_chk
    CHECK (target_seniority IN ('graduate', 'junior', 'mid', 'senior'));

ALTER TABLE challenges
    DROP CONSTRAINT IF EXISTS challenges_duration_minutes_chk;

ALTER TABLE challenges
    ADD CONSTRAINT challenges_duration_minutes_chk
    CHECK (duration_minutes BETWEEN 5 AND 300);

ALTER TABLE work_experience
    ADD COLUMN IF NOT EXISTS evidence_links JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE work_experience
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE work_experience
    ADD COLUMN IF NOT EXISTS risk_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE work_experience
    DROP CONSTRAINT IF EXISTS work_experience_verification_status_chk;

ALTER TABLE work_experience
    ADD CONSTRAINT work_experience_verification_status_chk
    CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected'));

ALTER TABLE work_experience
    DROP CONSTRAINT IF EXISTS work_experience_risk_score_chk;

ALTER TABLE work_experience
    ADD CONSTRAINT work_experience_risk_score_chk
    CHECK (risk_score BETWEEN 0 AND 100);

ALTER TABLE submissions
    DROP CONSTRAINT IF EXISTS submissions_language_chk;

ALTER TABLE submissions
    ADD CONSTRAINT submissions_language_chk
    CHECK (language IN ('javascript', 'python', 'java', 'cpp', 'go', 'csharp'));

ALTER TABLE submissions
    DROP CONSTRAINT IF EXISTS submissions_judge_status_chk;

ALTER TABLE submissions
    ADD CONSTRAINT submissions_judge_status_chk
    CHECK (judge_status IN ('queued', 'running', 'completed', 'failed'));

ALTER TABLE submissions
    ADD CONSTRAINT submissions_judge_run_id_fkey
    FOREIGN KEY (judge_run_id) REFERENCES submission_runs(id) ON DELETE SET NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS headline VARCHAR(255);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS location VARCHAR(255);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS github_url TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

CREATE TABLE IF NOT EXISTS proctoring_event_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'low',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    sequence_id BIGINT,
    client_timestamp TIMESTAMP,
    confidence FLOAT DEFAULT 0.5,
    duration_ms INTEGER DEFAULT 0,
    model_version VARCHAR(80),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proctoring_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trigger_type VARCHAR(100) NOT NULL,
    trigger_reason VARCHAR(120),
    image_data BYTEA NOT NULL,
    bytes INTEGER NOT NULL,
    quality_score FLOAT DEFAULT 0,
    sha256_hash VARCHAR(64),
    expires_at TIMESTAMP,
    encrypted_key_id VARCHAR(120),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proctoring_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    final_risk_score INTEGER NOT NULL DEFAULT 0,
    reasons_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proctoring_detector_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detector_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    degraded_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE proctoring_event_logs
    ADD COLUMN IF NOT EXISTS sequence_id BIGINT;

ALTER TABLE proctoring_event_logs
    ADD COLUMN IF NOT EXISTS client_timestamp TIMESTAMP;

ALTER TABLE proctoring_event_logs
    ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.5;

ALTER TABLE proctoring_event_logs
    ADD COLUMN IF NOT EXISTS duration_ms INTEGER DEFAULT 0;

ALTER TABLE proctoring_event_logs
    ADD COLUMN IF NOT EXISTS model_version VARCHAR(80);

ALTER TABLE proctoring_snapshots
    ADD COLUMN IF NOT EXISTS trigger_reason VARCHAR(120);

ALTER TABLE proctoring_snapshots
    ADD COLUMN IF NOT EXISTS quality_score FLOAT DEFAULT 0;

ALTER TABLE proctoring_snapshots
    ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64);

ALTER TABLE proctoring_snapshots
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

ALTER TABLE proctoring_snapshots
    ADD COLUMN IF NOT EXISTS encrypted_key_id VARCHAR(120);

ALTER TABLE proctoring_sessions
    DROP CONSTRAINT IF EXISTS proctoring_sessions_risk_state_chk;

ALTER TABLE proctoring_sessions
    ADD CONSTRAINT proctoring_sessions_risk_state_chk
    CHECK (risk_state IN ('observe', 'warn', 'elevated', 'paused'));

ALTER TABLE proctoring_sessions
    DROP CONSTRAINT IF EXISTS proctoring_sessions_risk_score_chk;

ALTER TABLE proctoring_sessions
    ADD CONSTRAINT proctoring_sessions_risk_score_chk
    CHECK (risk_score BETWEEN 0 AND 100);

ALTER TABLE proctoring_reviews
    DROP CONSTRAINT IF EXISTS proctoring_reviews_status_chk;

ALTER TABLE proctoring_reviews
    ADD CONSTRAINT proctoring_reviews_status_chk
    CHECK (status IN ('pending', 'running', 'completed', 'failed'));

INSERT INTO proctoring_settings (
    require_camera,
    require_microphone,
    require_audio,
    strict_mode,
    allowed_violations_before_warning,
    auto_pause_on_violation
)
SELECT true, true, true, false, 3, false
WHERE NOT EXISTS (SELECT 1 FROM proctoring_settings);

UPDATE challenges
SET publish_status = 'published'
WHERE publish_status IS NULL;

UPDATE challenges
SET target_seniority = CASE
    WHEN LOWER(difficulty) = 'easy' THEN 'graduate'
    WHEN LOWER(difficulty) = 'medium' THEN 'junior'
    ELSE 'mid'
END
WHERE target_seniority IS NULL OR target_seniority = '';

UPDATE challenges
SET duration_minutes = CASE
    WHEN LOWER(difficulty) = 'easy' THEN 30
    WHEN LOWER(difficulty) = 'medium' THEN 45
    ELSE 60
END
WHERE duration_minutes IS NULL OR duration_minutes <= 0;

UPDATE proctoring_sessions ps
SET duration_seconds = COALESCE(c.duration_minutes, 45) * 60,
    deadline_at = ps.start_time + make_interval(secs => COALESCE(c.duration_minutes, 45) * 60)
FROM challenges c
WHERE ps.challenge_id = c.id
  AND (ps.duration_seconds IS NULL OR ps.deadline_at IS NULL);

UPDATE work_experience
SET evidence_links = '[]'::jsonb
WHERE evidence_links IS NULL;

UPDATE work_experience
SET verification_status = CASE
    WHEN verified = true THEN 'verified'
    ELSE 'pending'
END
WHERE verification_status IS NULL OR verification_status = '';

UPDATE work_experience
SET risk_score = 0
WHERE risk_score IS NULL;

UPDATE submissions
SET judge_status = CASE
    WHEN status = 'graded' THEN 'completed'
    WHEN status = 'failed' THEN 'failed'
    ELSE 'queued'
END
WHERE judge_status IS NULL OR judge_status = '';

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_session_id ON submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_submissions_judge_status ON submissions(judge_status);
CREATE INDEX IF NOT EXISTS idx_submissions_judge_run_id ON submissions(judge_run_id);
CREATE INDEX IF NOT EXISTS idx_submissions_language ON submissions(language);

CREATE INDEX IF NOT EXISTS idx_work_experience_user_id ON work_experience(user_id);
CREATE INDEX IF NOT EXISTS idx_work_experience_status ON work_experience(verification_status);
CREATE INDEX IF NOT EXISTS idx_work_experience_risk ON work_experience(risk_score);
CREATE INDEX IF NOT EXISTS idx_reference_docs_challenge_id ON reference_docs(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenges_publish_status ON challenges(publish_status);
CREATE INDEX IF NOT EXISTS idx_challenges_target_seniority ON challenges(target_seniority);
CREATE INDEX IF NOT EXISTS idx_challenges_category_seniority ON challenges(category, target_seniority);

CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_user_id ON proctoring_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_challenge_id ON proctoring_sessions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_submission_id ON proctoring_sessions(submission_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_deadline_at ON proctoring_sessions(deadline_at);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_risk_state ON proctoring_sessions(risk_state);

CREATE INDEX IF NOT EXISTS idx_proctoring_logs_session_id ON proctoring_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_logs_user_id ON proctoring_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_logs_submission_id ON proctoring_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_logs_timestamp ON proctoring_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_proctoring_event_logs_session_id ON proctoring_event_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_event_logs_created_at ON proctoring_event_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_proctoring_event_logs_sequence ON proctoring_event_logs(session_id, sequence_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_event_logs_client_timestamp ON proctoring_event_logs(client_timestamp);
CREATE INDEX IF NOT EXISTS idx_proctoring_snapshots_session_id ON proctoring_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_snapshots_created_at ON proctoring_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_proctoring_snapshots_expires_at ON proctoring_snapshots(expires_at);
CREATE INDEX IF NOT EXISTS idx_proctoring_snapshots_sha256_hash ON proctoring_snapshots(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_proctoring_reviews_session_id ON proctoring_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_reviews_status ON proctoring_reviews(status);
CREATE INDEX IF NOT EXISTS idx_proctoring_detector_health_created_at ON proctoring_detector_health(created_at);

CREATE INDEX IF NOT EXISTS idx_ml_analysis_session_id ON ml_analysis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_ml_analysis_type ON ml_analysis_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_submission_runs_submission_id ON submission_runs(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_runs_status ON submission_runs(status);
CREATE INDEX IF NOT EXISTS idx_submission_run_tests_run_id ON submission_run_tests(submission_run_id);
CREATE INDEX IF NOT EXISTS idx_submission_run_tests_test_case_id ON submission_run_tests(test_case_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user_id ON admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_hint_events_user_challenge ON ai_hint_events(user_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_ai_hint_events_session ON ai_hint_events(session_id);
