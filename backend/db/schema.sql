CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'developer',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    difficulty VARCHAR(50) NOT NULL,
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
    paused_at TIMESTAMP,
    pause_reason TEXT,
    heartbeat_at TIMESTAMP,
    pause_count INTEGER DEFAULT 0,
    total_paused_seconds INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
    session_id UUID REFERENCES proctoring_sessions(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    score INTEGER,
    component_skill INTEGER,
    component_behavior INTEGER,
    component_work_experience INTEGER,
    component_penalty INTEGER DEFAULT 0,
    scoring_version VARCHAR(20),
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

CREATE TABLE IF NOT EXISTS work_experience (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    duration_months INTEGER NOT NULL,
    verified BOOLEAN DEFAULT false,
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

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES proctoring_sessions(id) ON DELETE SET NULL;

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

ALTER TABLE proctoring_sessions
    ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL;

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

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_session_id ON submissions(session_id);

CREATE INDEX IF NOT EXISTS idx_work_experience_user_id ON work_experience(user_id);
CREATE INDEX IF NOT EXISTS idx_reference_docs_challenge_id ON reference_docs(challenge_id);

CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_user_id ON proctoring_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_challenge_id ON proctoring_sessions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_submission_id ON proctoring_sessions(submission_id);

CREATE INDEX IF NOT EXISTS idx_proctoring_logs_session_id ON proctoring_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_logs_user_id ON proctoring_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_logs_submission_id ON proctoring_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_logs_timestamp ON proctoring_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_ml_analysis_session_id ON ml_analysis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_ml_analysis_type ON ml_analysis_results(analysis_type);
