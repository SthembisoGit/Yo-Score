import { query } from '../db';
import { config } from '../config';
import { getViolationPenalty, normalizeViolationType } from '../constants/violationPenalties';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { MlServiceAdapter } from '../adapters/mlService.adapter';
import {
  evaluateRiskSignals,
  type RiskEvaluation,
  type RiskState,
} from './proctoringRisk.service';

export interface ProctoringViolation {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  penalty: number;
  confidence?: number;
  evidence?: unknown;
}

export interface FaceAnalysisResult {
  faceCount: number;
  gazeDirection?: {
    lookingAway: boolean;
    direction: string;
    confidence: number;
  };
  eyesClosed: boolean;
  faceCoverage: number;
  confidence: number;
  hasFace: boolean;
}

export interface AudioAnalysisResult {
  hasSpeech: boolean;
  speechConfidence: number;
  voiceCount: number;
  noiseLevel: number;
  suspiciousKeywords: string[];
  transcript: string;
  error?: string;
}

export interface ObjectAnalysisResult {
  objects: Array<{
    category: string;
    confidence: number;
    boundingBox: number[];
  }>;
  screenCount: number;
}

export interface ProctoringSettings {
  requireCamera: boolean;
  requireMicrophone: boolean;
  requireAudio: boolean;
  strictMode: boolean;
  allowedViolationsBeforeWarning: number;
  autoPauseOnViolation: boolean;
}

export interface SessionHeartbeatPayload {
  cameraReady: boolean;
  microphoneReady: boolean;
  audioReady: boolean;
  isPaused?: boolean;
  windowFocused?: boolean;
  timestamp?: string;
}

export interface ProctoringSessionStartResult {
  sessionId: string;
  deadlineAt: string;
  durationSeconds: number;
}

export interface ProctoringConsentInput {
  policyVersion: string;
  acceptedAt: string;
  noticeLocale?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  consentScope?: string[];
}

export interface ProctoringEventInput {
  event_type: string;
  severity: 'low' | 'medium' | 'high';
  payload?: Record<string, unknown>;
  timestamp?: string;
  sequence_id?: number;
  client_ts?: string;
  confidence?: number;
  duration_ms?: number;
  model_version?: string;
}

export interface ProctoringRiskSnapshot {
  riskState: RiskState;
  riskScore: number;
  pauseRecommended: boolean;
  livenessRequired: boolean;
  reasons: string[];
}

export interface ProctoringHealthSnapshot {
  database: boolean;
  mlService: boolean;
  capabilities: {
    face_live: boolean;
    audio_live: boolean;
    deep_review_available: boolean;
    browser_consensus: boolean;
  };
  degraded_reasons: string[];
}

const MAX_EVENTS_PER_BATCH = 200;
const MAX_SNAPSHOT_BYTES = 400 * 1024;
const MAX_SNAPSHOTS_PER_SESSION = 40;

export class ProctoringService {
  private violationWeights: Record<string, ProctoringViolation> = {
    tab_switch: {
      type: 'tab_switch',
      severity: 'medium',
      description: 'User switched to another tab',
      penalty: 5,
    },
    window_blur: {
      type: 'window_blur',
      severity: 'low',
      description: 'Window lost focus',
      penalty: 3,
    },
    camera_off: {
      type: 'camera_off',
      severity: 'high',
      description: 'Camera turned off or not available',
      penalty: 10,
    },
    microphone_off: {
      type: 'microphone_off',
      severity: 'high',
      description: 'Microphone turned off or not available',
      penalty: 10,
    },
    audio_off: {
      type: 'audio_off',
      severity: 'high',
      description: 'Audio support unavailable',
      penalty: 8,
    },
    multiple_faces: {
      type: 'multiple_faces',
      severity: 'high',
      description: 'Multiple faces detected',
      penalty: 15,
    },
    no_face: {
      type: 'no_face',
      severity: 'medium',
      description: 'No face detected',
      penalty: 8,
    },
    looking_away: {
      type: 'looking_away',
      severity: 'medium',
      description: 'User looking away from screen',
      penalty: 7,
    },
    eyes_closed: {
      type: 'eyes_closed',
      severity: 'low',
      description: 'Eyes closed for extended period',
      penalty: 4,
    },
    face_covered: {
      type: 'face_covered',
      severity: 'medium',
      description: 'Face partially covered',
      penalty: 6,
    },
    inactivity: {
      type: 'inactivity',
      severity: 'low',
      description: 'No activity detected',
      penalty: 2,
    },
    copy_paste: {
      type: 'copy_paste',
      severity: 'high',
      description: 'Copy/paste detected',
      penalty: 12,
    },
    dev_tools: {
      type: 'dev_tools',
      severity: 'high',
      description: 'Developer tools opened',
      penalty: 10,
    },
    speech_detected: {
      type: 'speech_detected',
      severity: 'medium',
      description: 'Speech detected',
      penalty: 8,
    },
    multiple_voices: {
      type: 'multiple_voices',
      severity: 'high',
      description: 'Multiple voices detected',
      penalty: 20,
    },
    forbidden_object: {
      type: 'forbidden_object',
      severity: 'high',
      description: 'Forbidden object detected',
      penalty: 15,
    },
    multiple_screens: {
      type: 'multiple_screens',
      severity: 'medium',
      description: 'Multiple screens detected',
      penalty: 10,
    },
    high_background_noise: {
      type: 'high_background_noise',
      severity: 'low',
      description: 'High background noise',
      penalty: 3,
    },
    suspicious_conversation: {
      type: 'suspicious_conversation',
      severity: 'high',
      description: 'Suspicious conversation detected',
      penalty: 12,
    },
    heartbeat_timeout: {
      type: 'heartbeat_timeout',
      severity: 'high',
      description: 'Proctoring heartbeat timeout',
      penalty: 8,
    },
  };

  private readonly mlServiceAdapter: MlServiceAdapter;
  private schemaEnsured = false;
  private readonly heartbeatTimeoutSeconds = 15;
  private readonly evidenceRetentionDays = Math.max(1, Number(config.PROCTORING_EVIDENCE_RETENTION_DAYS ?? 7));
  private readonly encryptedKeyId = config.PROCTORING_ENCRYPTED_KEY_ID || 'yoscore-default-key';
  private readonly consensusWindowSeconds = Math.max(10, Number(config.PROCTORING_CONSENSUS_WINDOW_SECONDS ?? 30));
  private readonly highConfidenceThreshold = Math.max(
    0.5,
    Math.min(0.99, Number(config.PROCTORING_HIGH_CONFIDENCE_THRESHOLD ?? 0.85)),
  );
  private readonly requireConsent = String(config.PROCTORING_REQUIRE_CONSENT).toLowerCase() === 'true';
  private readonly privacyPolicyVersion = String(config.PROCTORING_PRIVACY_POLICY_VERSION || '2026-02-25');
  private readonly privacyPolicyUrl = config.PROCTORING_PRIVACY_POLICY_URL || '';

  constructor() {
    this.mlServiceAdapter = new MlServiceAdapter(config.ML_SERVICE_URL || 'http://localhost:5000');
  }

  private async ensureSessionSchemaExtensions(): Promise<void> {
    if (this.schemaEnsured) return;

    await query(
      `ALTER TABLE proctoring_sessions
         ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP,
         ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
         ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
         ADD COLUMN IF NOT EXISTS pause_reason TEXT,
         ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMP,
         ADD COLUMN IF NOT EXISTS pause_count INTEGER DEFAULT 0,
         ADD COLUMN IF NOT EXISTS total_paused_seconds INTEGER DEFAULT 0,
         ADD COLUMN IF NOT EXISTS risk_state VARCHAR(20) DEFAULT 'observe',
         ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0,
         ADD COLUMN IF NOT EXISTS liveness_required BOOLEAN DEFAULT false,
         ADD COLUMN IF NOT EXISTS liveness_challenge JSONB DEFAULT '{}'::jsonb,
         ADD COLUMN IF NOT EXISTS liveness_completed_at TIMESTAMP,
         ADD COLUMN IF NOT EXISTS last_sequence_id BIGINT DEFAULT 0,
         ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMP,
         ADD COLUMN IF NOT EXISTS privacy_policy_version VARCHAR(40),
         ADD COLUMN IF NOT EXISTS privacy_notice_locale VARCHAR(16),
         ADD COLUMN IF NOT EXISTS privacy_ip_hash VARCHAR(64),
         ADD COLUMN IF NOT EXISTS privacy_user_agent TEXT,
         ADD COLUMN IF NOT EXISTS privacy_consent_scope JSONB DEFAULT '[]'::jsonb,
         ADD COLUMN IF NOT EXISTS evidence_retention_days INTEGER DEFAULT 7`,
    );

    await query(
      `CREATE TABLE IF NOT EXISTS proctoring_event_logs (
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
       )`,
    );

    await query(
      `CREATE TABLE IF NOT EXISTS proctoring_snapshots (
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
       )`,
    );

    await query(
      `CREATE TABLE IF NOT EXISTS proctoring_reviews (
         id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
         session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
         status VARCHAR(20) NOT NULL DEFAULT 'pending',
         final_risk_score INTEGER NOT NULL DEFAULT 0,
         reasons_json JSONB NOT NULL DEFAULT '{}'::jsonb,
         reviewed_at TIMESTAMP,
         created_at TIMESTAMP DEFAULT NOW()
       )`,
    );

    await query(
      `ALTER TABLE proctoring_sessions
         DROP CONSTRAINT IF EXISTS proctoring_sessions_risk_state_chk`,
    );
    await query(
      `ALTER TABLE proctoring_sessions
         ADD CONSTRAINT proctoring_sessions_risk_state_chk
         CHECK (risk_state IN ('observe', 'warn', 'elevated', 'paused'))`,
    );
    await query(
      `ALTER TABLE proctoring_sessions
         DROP CONSTRAINT IF EXISTS proctoring_sessions_risk_score_chk`,
    );
    await query(
      `ALTER TABLE proctoring_sessions
         ADD CONSTRAINT proctoring_sessions_risk_score_chk
         CHECK (risk_score BETWEEN 0 AND 100)`,
    );
    await query(
      `ALTER TABLE proctoring_reviews
         DROP CONSTRAINT IF EXISTS proctoring_reviews_status_chk`,
    );
    await query(
      `ALTER TABLE proctoring_reviews
         ADD CONSTRAINT proctoring_reviews_status_chk
         CHECK (status IN ('pending', 'running', 'completed', 'failed'))`,
    );

    await query(
      `CREATE INDEX IF NOT EXISTS idx_proctoring_event_logs_session_id
       ON proctoring_event_logs(session_id)`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_proctoring_event_logs_created_at
       ON proctoring_event_logs(created_at)`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_proctoring_snapshots_session_id
       ON proctoring_snapshots(session_id)`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_proctoring_snapshots_created_at
       ON proctoring_snapshots(created_at)`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_proctoring_event_logs_sequence
       ON proctoring_event_logs(session_id, sequence_id)`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_proctoring_snapshots_expires_at
       ON proctoring_snapshots(expires_at)`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_proctoring_reviews_session_id
       ON proctoring_reviews(session_id)`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_risk_state
       ON proctoring_sessions(risk_state)`,
    );

    this.schemaEnsured = true;
  }

  private buildEvidenceExpiryDate(baseDate?: Date): Date {
    const anchor = baseDate ?? new Date();
    return new Date(anchor.getTime() + this.evidenceRetentionDays * 24 * 60 * 60 * 1000);
  }

  private sanitizeMlResults(analysisType: string, results: unknown): unknown {
    if (analysisType !== 'audio' || !results || typeof results !== 'object') {
      return results;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(results as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes('transcript') ||
        normalizedKey.includes('utterance') ||
        normalizedKey.includes('raw_audio')
      ) {
        continue;
      }
      sanitized[key] = value;
    }

    return sanitized;
  }

  private async recordSensitiveAccess(
    adminUserId: string,
    targetUserId: string,
    sessionId: string,
  ): Promise<void> {
    await query(
      `INSERT INTO admin_audit_logs
         (admin_user_id, target_user_id, action, details, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [
        adminUserId,
        targetUserId,
        'proctoring_sensitive_read',
        JSON.stringify({
          session_id: sessionId,
          accessed_at: new Date().toISOString(),
        }),
      ],
    ).catch(() => undefined);
  }

  getPrivacyNotice(): {
    require_consent: boolean;
    policy_version: string;
    policy_url: string | null;
    retention_days: number;
    capture_scope: string[];
  } {
    return {
      require_consent: this.requireConsent,
      policy_version: this.privacyPolicyVersion,
      policy_url: this.privacyPolicyUrl || null,
      retention_days: this.evidenceRetentionDays,
      capture_scope: [
        'camera_presence_signals',
        'microphone_device_state',
        'proctoring_events',
        'limited_snapshots_on_triggers',
      ],
    };
  }

  private createLivenessChallenge(): {
    challenge_id: string;
    expected_action: 'turn_left' | 'turn_right' | 'look_up' | 'look_down' | 'blink_once';
    prompt: string;
    expires_at: string;
    created_at: string;
  } {
    const options = [
      {
        action: 'turn_left' as const,
        prompt: 'Turn your head slightly to the left, then press "Verify liveness".',
      },
      {
        action: 'turn_right' as const,
        prompt: 'Turn your head slightly to the right, then press "Verify liveness".',
      },
      {
        action: 'look_up' as const,
        prompt: 'Look up briefly, then press "Verify liveness".',
      },
      {
        action: 'look_down' as const,
        prompt: 'Look down briefly, then press "Verify liveness".',
      },
      {
        action: 'blink_once' as const,
        prompt: 'Blink once clearly, then press "Verify liveness".',
      },
    ];
    const selected = options[Math.floor(Math.random() * options.length)];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 45_000);

    return {
      challenge_id: `lv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      expected_action: selected.action,
      prompt: selected.prompt,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    };
  }

  private async computeRiskForSession(sessionId: string): Promise<RiskEvaluation> {
    const result = await query(
      `SELECT event_type, severity, confidence, duration_ms, created_at
       FROM proctoring_event_logs
       WHERE session_id = $1
         AND created_at >= NOW() - make_interval(secs => $2::int)
       ORDER BY created_at DESC
       LIMIT 300`,
      [sessionId, this.consensusWindowSeconds],
    );

    return evaluateRiskSignals(
      result.rows.map((row) => ({
        event_type: row.event_type,
        severity: row.severity,
        confidence: Number(row.confidence ?? 0.5),
        duration_ms: Number(row.duration_ms ?? 0),
        created_at: row.created_at,
      })),
      {
        windowSeconds: this.consensusWindowSeconds,
        highConfidenceThreshold: this.highConfidenceThreshold,
      },
    );
  }

  private async persistSessionRiskState(sessionId: string, risk: RiskEvaluation): Promise<void> {
    await query(
      `UPDATE proctoring_sessions
       SET risk_state = $2,
           risk_score = $3
       WHERE id = $1`,
      [sessionId, risk.riskState, risk.riskScore],
    );
  }

  // Session Management
  async startSession(
    userId: string,
    challengeId: string,
    consent?: ProctoringConsentInput,
  ): Promise<ProctoringSessionStartResult> {
    await this.ensureSessionSchemaExtensions();

    if (this.requireConsent) {
      if (!consent || !consent.acceptedAt || !consent.policyVersion) {
        throw new Error('Proctoring privacy consent is required');
      }
      if (consent.policyVersion !== this.privacyPolicyVersion) {
        throw new Error('Proctoring privacy policy version mismatch');
      }
    }

    const challengeResult = await query(
      `SELECT duration_minutes
       FROM challenges
       WHERE id = $1`,
      [challengeId],
    );
    let durationMinutes = Number(challengeResult.rows[0]?.duration_minutes ?? 45);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      durationMinutes = 45;
    }
    // Guard against legacy data accidentally stored in seconds.
    if (durationMinutes > 300) {
      durationMinutes = Math.round(durationMinutes / 60);
    }
    durationMinutes = Math.min(300, Math.max(5, durationMinutes));
    const durationSeconds = Math.max(300, durationMinutes * 60);
    const deadlineAt = new Date(Date.now() + durationSeconds * 1000);

    let result;
    try {
      const consentAcceptedAt = consent?.acceptedAt
        ? new Date(consent.acceptedAt).toISOString()
        : null;
      const consentScope = Array.isArray(consent?.consentScope)
        ? consent?.consentScope
        : [];
      result = await query(
        `INSERT INTO proctoring_sessions
           (user_id, challenge_id, start_time, status, heartbeat_at, deadline_at, duration_seconds, paused_at, pause_reason, pause_count, total_paused_seconds, risk_state, risk_score, liveness_required, last_sequence_id, privacy_consent_at, privacy_policy_version, privacy_notice_locale, privacy_ip_hash, privacy_user_agent, privacy_consent_scope, evidence_retention_days)
         VALUES ($1, $2, NOW(), 'active', NOW(), $3, $4, NULL, NULL, 0, 0, 'observe', 0, false, 0, $5, $6, $7, $8, $9, $10::jsonb, $11)
         RETURNING id`,
        [
          userId,
          challengeId,
          deadlineAt.toISOString(),
          durationSeconds,
          consentAcceptedAt,
          consent?.policyVersion ?? null,
          consent?.noticeLocale ?? null,
          consent?.ipHash ?? null,
          consent?.userAgent ?? null,
          JSON.stringify(consentScope),
          this.evidenceRetentionDays,
        ],
      );
    } catch {
      // Fallback for older schemas that haven't applied extension columns yet.
      logger.warn('Falling back to legacy proctoring session insert without privacy columns', {
        challengeId,
        userId,
      });
      result = await query(
        `INSERT INTO proctoring_sessions (user_id, challenge_id, start_time, status)
         VALUES ($1, $2, NOW(), 'active')
         RETURNING id`,
        [userId, challengeId],
      );
    }

    return {
      sessionId: result.rows[0].id,
      deadlineAt: deadlineAt.toISOString(),
      durationSeconds,
    };
  }

  async endSession(sessionId: string, userId: string, submissionId?: string): Promise<void> {
    await this.ensureSessionSchemaExtensions();
    const result = await query(
      `UPDATE proctoring_sessions 
       SET end_time = NOW(), 
            status = 'completed',
            paused_at = NULL,
            pause_reason = NULL,
            submission_id = $2
       WHERE id = $1
         AND user_id = $3`,
      [sessionId, submissionId ?? null, userId],
    );
    if (result.rowCount === 0) {
      throw new Error('Session not found');
    }

    // Phase 2: async post-exam evidence review (non-blocking)
    setImmediate(() => {
      void this.runPostExamReview(sessionId);
    });
  }

  async pauseSession(
    sessionId: string,
    userId: string,
    reason: string,
  ): Promise<{
    status: 'active' | 'paused' | 'completed';
    pauseReason: string | null;
    pausedAt: string | null;
  }> {
    await this.ensureSessionSchemaExtensions();

    const sessionResult = await query(
      `SELECT status, paused_at, liveness_required
       FROM proctoring_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const current = sessionResult.rows[0];
    if (current.status === 'completed') {
      throw new Error('Completed sessions cannot be paused');
    }

    const updated = await query(
      `UPDATE proctoring_sessions
       SET status = 'paused',
           risk_state = 'paused',
           paused_at = COALESCE(paused_at, NOW()),
           pause_reason = $3,
           pause_count = COALESCE(pause_count, 0) + CASE WHEN status = 'paused' THEN 0 ELSE 1 END,
           heartbeat_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING status, pause_reason, paused_at`,
      [sessionId, userId, reason],
    );

    return {
      status: updated.rows[0].status,
      pauseReason: updated.rows[0].pause_reason ?? null,
      pausedAt: updated.rows[0].paused_at
        ? new Date(updated.rows[0].paused_at).toISOString()
        : null,
    };
  }

  async resumeSession(
    sessionId: string,
    userId: string,
  ): Promise<{
    status: 'active' | 'paused' | 'completed';
    pauseReason: string | null;
  }> {
    await this.ensureSessionSchemaExtensions();

    const sessionResult = await query(
      `SELECT status, paused_at, liveness_required
       FROM proctoring_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const current = sessionResult.rows[0];
    if (current.status === 'completed') {
      throw new Error('Completed sessions cannot be resumed');
    }
    if (Boolean(current.liveness_required)) {
      throw new Error('Liveness check required before resume');
    }

    const pausedAtValue = current.paused_at ? new Date(current.paused_at) : null;
    const pausedDurationSeconds = pausedAtValue
      ? Math.max(0, Math.floor((Date.now() - pausedAtValue.getTime()) / 1000))
      : 0;

    const updated = await query(
      `UPDATE proctoring_sessions
       SET status = 'active',
           risk_state = CASE
             WHEN COALESCE(risk_score, 0) >= 55 THEN 'elevated'
             WHEN COALESCE(risk_score, 0) >= 25 THEN 'warn'
             ELSE 'observe'
           END,
           pause_reason = NULL,
           paused_at = NULL,
           heartbeat_at = NOW(),
           total_paused_seconds = COALESCE(total_paused_seconds, 0) + $3
       WHERE id = $1 AND user_id = $2
       RETURNING status, pause_reason`,
      [sessionId, userId, pausedDurationSeconds],
    );

    return {
      status: updated.rows[0].status,
      pauseReason: updated.rows[0].pause_reason ?? null,
    };
  }

  async recordHeartbeat(
    sessionId: string,
    userId: string,
    payload: SessionHeartbeatPayload,
  ): Promise<{
    status: 'active' | 'paused' | 'completed';
    pauseReason: string | null;
    heartbeatAt: string;
  }> {
    await this.ensureSessionSchemaExtensions();

    const sessionResult = await query(
      `SELECT status, pause_reason
       FROM proctoring_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const currentStatus = sessionResult.rows[0].status as 'active' | 'paused' | 'completed';

    if (currentStatus === 'completed') {
      return {
        status: 'completed',
        pauseReason: sessionResult.rows[0].pause_reason ?? null,
        heartbeatAt: new Date().toISOString(),
      };
    }

    const missingRequiredDevice =
      payload.cameraReady === false ||
      payload.microphoneReady === false;

    if (missingRequiredDevice) {
      const reasonParts: string[] = [];
      if (!payload.cameraReady) reasonParts.push('camera');
      if (!payload.microphoneReady) reasonParts.push('microphone');
      const reason = `Required proctoring device unavailable: ${reasonParts.join(', ')}`;
      const paused = await this.pauseSession(sessionId, userId, reason);
      return {
        status: paused.status,
        pauseReason: paused.pauseReason,
        heartbeatAt: new Date().toISOString(),
      };
    }

    const updated = await query(
      `UPDATE proctoring_sessions
       SET heartbeat_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING status, pause_reason, heartbeat_at`,
      [sessionId, userId],
    );

    return {
      status: updated.rows[0].status,
      pauseReason: updated.rows[0].pause_reason ?? null,
      heartbeatAt: updated.rows[0].heartbeat_at
        ? new Date(updated.rows[0].heartbeat_at).toISOString()
        : new Date().toISOString(),
    };
  }

  async ingestEventBatch(
    sessionId: string,
    userId: string,
    events: ProctoringEventInput[],
    sequenceStart?: number,
  ): Promise<{
    accepted: number;
    status: 'active' | 'paused' | 'completed';
    risk_state: RiskState;
    risk_score: number;
    pause_recommended: boolean;
    liveness_required: boolean;
    reasons: string[];
  }> {
    await this.ensureSessionSchemaExtensions();

    const sessionResult = await query(
      `SELECT id, status
       FROM proctoring_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const sessionStatus = sessionResult.rows[0].status as 'active' | 'paused' | 'completed';
    if (sessionStatus === 'completed') {
      return {
        accepted: 0,
        status: 'completed',
        risk_state: 'observe',
        risk_score: 0,
        pause_recommended: false,
        liveness_required: false,
        reasons: [],
      };
    }

    const validEvents = events
      .slice(0, MAX_EVENTS_PER_BATCH)
      .filter((event) => typeof event.event_type === 'string' && event.event_type.trim().length > 0)
      .map((event, index) => ({
        eventType: normalizeViolationType(event.event_type),
        severity:
          event.severity === 'high' || event.severity === 'medium' || event.severity === 'low'
            ? event.severity
            : 'low',
        payload: event.payload ?? {},
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        sequenceId:
          Number.isFinite(Number(event.sequence_id))
            ? Number(event.sequence_id)
            : Number.isFinite(Number(sequenceStart))
              ? Number(sequenceStart) + index
              : null,
        clientTimestamp: event.client_ts ? new Date(event.client_ts) : null,
        confidence: Math.max(0, Math.min(1, Number(event.confidence ?? 0.5))),
        durationMs: Math.max(0, Number(event.duration_ms ?? 0)),
        modelVersion:
          typeof event.model_version === 'string' && event.model_version.trim().length > 0
            ? event.model_version.trim().slice(0, 80)
            : null,
      }))
      .filter((event) => !Number.isNaN(event.timestamp.getTime()));

    for (const event of validEvents) {
      const clientTs =
        event.clientTimestamp && !Number.isNaN(event.clientTimestamp.getTime())
          ? event.clientTimestamp.toISOString()
          : null;
      await query(
        `INSERT INTO proctoring_event_logs
           (session_id, user_id, event_type, severity, payload, created_at, sequence_id, client_timestamp, confidence, duration_ms, model_version)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)`,
        [
          sessionId,
          userId,
          event.eventType,
          event.severity,
          JSON.stringify(event.payload),
          event.timestamp.toISOString(),
          event.sequenceId,
          clientTs,
          event.confidence,
          event.durationMs,
          event.modelVersion,
        ],
      );
    }

    const maxSequenceId = validEvents.reduce<number | null>((max, event) => {
      if (event.sequenceId === null || Number.isNaN(event.sequenceId)) return max;
      if (max === null) return event.sequenceId;
      return Math.max(max, event.sequenceId);
    }, null);

    if (maxSequenceId !== null) {
      await query(
        `UPDATE proctoring_sessions
         SET last_sequence_id = GREATEST(COALESCE(last_sequence_id, 0), $2::bigint)
         WHERE id = $1`,
        [sessionId, Math.floor(maxSequenceId)],
      );
    }

    const risk = await this.computeRiskForSession(sessionId);
    await this.persistSessionRiskState(sessionId, risk);

    let status: 'active' | 'paused' | 'completed' = sessionStatus;
    if (risk.pauseRecommended && status === 'active') {
      const reason = `Consensus risk pause: ${risk.reasons.join(' | ') || 'high-risk behavior detected'}`;
      const paused = await this.pauseSession(sessionId, userId, reason);
      status = paused.status;

      if (risk.livenessRequired) {
        const challenge = this.createLivenessChallenge();
        await query(
          `UPDATE proctoring_sessions
           SET liveness_required = true,
               liveness_challenge = $2::jsonb
           WHERE id = $1`,
          [sessionId, JSON.stringify(challenge)],
        );
      }
    }

    return {
      accepted: validEvents.length,
      status,
      risk_state: risk.riskState,
      risk_score: risk.riskScore,
      pause_recommended: risk.pauseRecommended,
      liveness_required: risk.livenessRequired,
      reasons: risk.reasons,
    };
  }

  async storeSnapshot(
    sessionId: string,
    userId: string,
    triggerType: string,
    imageBuffer: Buffer,
    metadata: Record<string, unknown> = {},
  ): Promise<{ snapshot_id: string; bytes: number; expires_at: string }> {
    await this.ensureSessionSchemaExtensions();

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Snapshot image data is required');
    }

    if (imageBuffer.length > MAX_SNAPSHOT_BYTES) {
      throw new Error(`Snapshot exceeds ${MAX_SNAPSHOT_BYTES} bytes limit`);
    }

    const sessionResult = await query(
      `SELECT id
       FROM proctoring_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const countResult = await query(
      `SELECT COUNT(*)::int as count
       FROM proctoring_snapshots
       WHERE session_id = $1`,
      [sessionId],
    );
    const currentCount = Number(countResult.rows[0]?.count ?? 0);
    if (currentCount >= MAX_SNAPSHOTS_PER_SESSION) {
      throw new Error('Snapshot limit reached for this session');
    }

    const normalizedTrigger = normalizeViolationType(triggerType || 'sampled_snapshot');
    const triggerReason =
      typeof metadata.trigger_reason === 'string'
        ? metadata.trigger_reason.slice(0, 120)
        : typeof metadata.reason === 'string'
          ? metadata.reason.slice(0, 120)
          : null;
    const qualityScoreRaw = Number(metadata.quality_score ?? metadata.quality ?? 0);
    const qualityScore = Number.isFinite(qualityScoreRaw)
      ? Math.max(0, Math.min(1, qualityScoreRaw))
      : 0;
    const hash = createHash('sha256').update(imageBuffer).digest('hex');
    const expiresAt = this.buildEvidenceExpiryDate();

    const result = await query(
      `INSERT INTO proctoring_snapshots
         (session_id, user_id, trigger_type, trigger_reason, image_data, bytes, quality_score, sha256_hash, expires_at, encrypted_key_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING id, bytes`,
      [
        sessionId,
        userId,
        normalizedTrigger,
        triggerReason,
        imageBuffer,
        imageBuffer.length,
        qualityScore,
        hash,
        expiresAt.toISOString(),
        this.encryptedKeyId,
        JSON.stringify(metadata ?? {}),
      ],
    );

    await query(
      `INSERT INTO proctoring_event_logs
         (session_id, user_id, event_type, severity, payload, confidence, duration_ms, model_version)
       VALUES ($1, $2, 'snapshot_captured', 'low', $3::jsonb, $4, $5, $6)`,
      [
        sessionId,
        userId,
        JSON.stringify({
          trigger_type: normalizedTrigger,
          trigger_reason: triggerReason,
          bytes: imageBuffer.length,
          sha256_hash: hash,
        }),
        1,
        0,
        'backend-snapshot-v1',
      ],
    );

    return {
      snapshot_id: result.rows[0].id,
      bytes: Number(result.rows[0].bytes),
      expires_at: expiresAt.toISOString(),
    };
  }

  private async runPostExamReview(sessionId: string): Promise<void> {
    try {
      await this.ensureSessionSchemaExtensions();

      await query(
        `INSERT INTO proctoring_reviews
           (session_id, status, final_risk_score, reasons_json)
         VALUES ($1, 'running', 0, '{}'::jsonb)`,
        [sessionId],
      );

      const [eventsResult, snapshotsResult] = await Promise.all([
        query(
          `SELECT severity, event_type, confidence, duration_ms, created_at
           FROM proctoring_event_logs
           WHERE session_id = $1`,
          [sessionId],
        ),
        query(
          `SELECT trigger_type, trigger_reason, bytes, quality_score
           FROM proctoring_snapshots
           WHERE session_id = $1`,
          [sessionId],
        ),
      ]);

      const eventCount = eventsResult.rows.length;
      const highSeverityCount = eventsResult.rows.filter((row) => row.severity === 'high').length;
      const mediumSeverityCount = eventsResult.rows.filter((row) => row.severity === 'medium').length;
      const snapshotCount = snapshotsResult.rows.length;
      const snapshotBytes = snapshotsResult.rows.reduce(
        (sum, row) => sum + Number(row.bytes ?? 0),
        0,
      );
      const reviewRisk = evaluateRiskSignals(
        eventsResult.rows.map((row) => ({
          event_type: String(row.event_type ?? ''),
          severity:
            row.severity === 'high' || row.severity === 'medium' || row.severity === 'low'
              ? row.severity
              : 'low',
          confidence: Number(row.confidence ?? 0.5),
          duration_ms: Number(row.duration_ms ?? 0),
          created_at: row.created_at,
        })),
        {
          windowSeconds: Math.max(this.consensusWindowSeconds, 90),
          highConfidenceThreshold: this.highConfidenceThreshold,
        },
      );
      const averageSnapshotQuality =
        snapshotCount > 0
          ? snapshotsResult.rows.reduce((sum, row) => sum + Number(row.quality_score ?? 0), 0) /
            snapshotCount
          : 0;

      await this.logMLAnalysis(
        sessionId,
        'post_exam_review',
        new Date().toISOString(),
        {
          event_count: eventCount,
          high_severity_count: highSeverityCount,
          medium_severity_count: mediumSeverityCount,
          snapshot_count: snapshotCount,
          snapshot_bytes: snapshotBytes,
          average_snapshot_quality: averageSnapshotQuality,
          risk_state: reviewRisk.riskState,
          risk_score: reviewRisk.riskScore,
          pause_recommended: reviewRisk.pauseRecommended,
          top_events: eventsResult.rows
            .reduce<Record<string, number>>((acc, row) => {
              const type = String(row.event_type);
              acc[type] = (acc[type] ?? 0) + 1;
              return acc;
            }, {}),
        },
        [],
      );

      await query(
        `INSERT INTO proctoring_reviews
           (session_id, status, final_risk_score, reasons_json, reviewed_at)
         VALUES ($1, 'completed', $2, $3::jsonb, NOW())`,
        [
          sessionId,
          reviewRisk.riskScore,
          JSON.stringify({
            reasons: reviewRisk.reasons,
            event_count: eventCount,
            high_severity_count: highSeverityCount,
            medium_severity_count: mediumSeverityCount,
            snapshot_count: snapshotCount,
            snapshot_bytes: snapshotBytes,
            average_snapshot_quality: averageSnapshotQuality,
          }),
        ],
      );

      await this.persistSessionRiskState(sessionId, reviewRisk);
    } catch (error) {
      logger.error('Post-exam proctoring review failed', { error });
      await query(
        `INSERT INTO proctoring_reviews
           (session_id, status, final_risk_score, reasons_json, reviewed_at)
         VALUES ($1, 'failed', 0, $2::jsonb, NOW())`,
        [
          sessionId,
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown review error',
          }),
        ],
      ).catch(() => undefined);
    }
  }

  // Basic Violation Logging
  private mapMlViolation(
    violationType: string,
    description?: string,
    confidence?: number,
  ): ProctoringViolation {
    const normalizedType = normalizeViolationType(violationType);
    const base = this.violationWeights[normalizedType] ?? {
      type: normalizedType,
      severity: 'medium' as const,
      description: description || `Violation: ${normalizedType}`,
      penalty: getViolationPenalty(normalizedType),
    };

    return {
      ...base,
      type: normalizedType,
      description: description ?? base.description,
      penalty: getViolationPenalty(normalizedType),
      confidence,
    };
  }

  async logViolation(
    sessionId: string,
    userId: string,
    violationType: string,
    description?: string,
    evidence?: unknown,
  ): Promise<ProctoringViolation> {
    const normalizedType = normalizeViolationType(violationType);
    const base = this.violationWeights[normalizedType] ?? {
      type: normalizedType,
      severity: 'medium' as const,
      description: description || `Violation: ${normalizedType}`,
      penalty: getViolationPenalty(normalizedType),
    };

    const violation: ProctoringViolation = {
      ...base,
      type: normalizedType,
      description: description ?? base.description,
      penalty: getViolationPenalty(normalizedType),
    };

    await query(
      `INSERT INTO proctoring_logs 
       (session_id, user_id, violation_type, severity, description, penalty, timestamp, evidence_data)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
      [
        sessionId,
        userId,
        violation.type,
        violation.severity,
        violation.description,
        violation.penalty,
        evidence ? JSON.stringify(evidence) : null,
      ],
    );

    await query(
      `UPDATE proctoring_sessions 
       SET total_violations = total_violations + 1,
           total_penalty = total_penalty + $2
       WHERE id = $1`,
      [sessionId, violation.penalty],
    );

    return violation;
  }

  async logMultipleViolations(
    sessionId: string,
    userId: string,
    violations: Array<{ type: string; description?: string; evidence?: unknown }>,
  ): Promise<ProctoringViolation[]> {
    const logged: ProctoringViolation[] = [];

    for (const v of violations) {
      const violation = await this.logViolation(
        sessionId,
        userId,
        v.type,
        v.description,
        v.evidence,
      );
      logged.push(violation);
    }

    return logged;
  }

  // ML Analysis Methods
  async analyzeFaceFrame(
    sessionId: string,
    imageBuffer: Buffer,
    timestamp: string,
  ): Promise<{ result: FaceAnalysisResult; violations: ProctoringViolation[] }> {
    try {
      // Ensure session exists before storing analysis artifacts.
      const sessionResult = await query(
        `SELECT 1 FROM proctoring_sessions WHERE id = $1`,
        [sessionId],
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found');
      }

      const mlResult = await this.mlServiceAdapter.analyzeFace({
        sessionId,
        timestamp,
        imageBuffer,
      });

      if (!mlResult?.success) {
        throw new Error('ML analysis failed');
      }

      await this.logMLAnalysis(
        sessionId,
        'face',
        timestamp,
        mlResult.results,
        mlResult.violations || [],
      );

      const violations: ProctoringViolation[] = (mlResult.violations || []).map((mlViolation: any) =>
        this.mapMlViolation(mlViolation.type, mlViolation.description, mlViolation.confidence),
      );

      const analysisResult = mlResult.results as unknown as FaceAnalysisResult;

      return {
        result: analysisResult,
        violations,
      };
    } catch (error) {
      logger.error('Face analysis failed', { error });
      throw new Error('Face analysis temporarily unavailable');
    }
  }

  async analyzeAudioChunk(
    sessionId: string,
    audioBuffer: Buffer,
    timestamp: string,
    durationMs: number,
  ): Promise<{ result: AudioAnalysisResult; violations: ProctoringViolation[] }> {
    try {
      // Ensure session exists before storing analysis artifacts.
      const sessionResult = await query(
        `SELECT 1 FROM proctoring_sessions WHERE id = $1`,
        [sessionId],
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found');
      }

      const mlResult = await this.mlServiceAdapter.analyzeAudio({
        sessionId,
        timestamp,
        audioBuffer,
        durationMs,
      });

      if (!mlResult?.success) {
        throw new Error('Audio analysis failed');
      }

      const sanitizedResults = this.sanitizeMlResults('audio', mlResult.results);

      await this.logMLAnalysis(
        sessionId,
        'audio',
        timestamp,
        sanitizedResults,
        mlResult.violations || [],
      );

      const violations: ProctoringViolation[] = (mlResult.violations || []).map((mlViolation: any) =>
        this.mapMlViolation(mlViolation.type, mlViolation.description, mlViolation.confidence),
      );

      const analysisResult = mlResult.results as unknown as AudioAnalysisResult;

      return {
        result: {
          ...analysisResult,
          transcript: '',
        },
        violations,
      };
    } catch (error) {
      logger.error('Audio analysis failed', { error });

      // Return neutral result on error (no false positives)
      return {
        result: {
          hasSpeech: false,
          speechConfidence: 0,
          voiceCount: 0,
          noiseLevel: 0,
          suspiciousKeywords: [],
          transcript: '',
          error: 'Audio analysis unavailable',
        },
        violations: [],
      };
    }
  }

  private async logMLAnalysis(
    sessionId: string,
    analysisType: string,
    timestamp: string,
    results: unknown,
    violations: unknown[],
  ): Promise<void> {
    await query(
      `INSERT INTO ml_analysis_results 
       (session_id, analysis_type, timestamp, results, violations_detected, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        sessionId,
        analysisType,
        new Date(timestamp).toISOString(),
        JSON.stringify(results),
        Array.isArray(violations) ? violations.length : 0,
      ],
    );
  }

  // Session Data Retrieval
  async getSessionViolations(sessionId: string): Promise<any[]> {
    const result = await query(
      `SELECT id, violation_type, severity, description, penalty, confidence, timestamp, evidence_data
       FROM proctoring_logs
       WHERE session_id = $1
       ORDER BY timestamp`,
      [sessionId],
    );

    return result.rows.map((row) => ({
      ...row,
      evidence_data:
        typeof row.evidence_data === 'string'
          ? JSON.parse(row.evidence_data)
          : row.evidence_data ?? null,
    }));
  }

  async getMLAnalysisResults(sessionId: string, analysisType?: string): Promise<any[]> {
    let sql = `SELECT id, session_id, analysis_type, timestamp, results, violations_detected, created_at
               FROM ml_analysis_results
               WHERE session_id = $1`;
    const params: unknown[] = [sessionId];

    if (analysisType) {
      sql += ` AND analysis_type = $2`;
      params.push(analysisType);
    }

    sql += ` ORDER BY timestamp`;

    const result = await query(sql, params);
    return result.rows.map((row) => ({
      ...row,
      results: typeof row.results === 'string' ? JSON.parse(row.results) : row.results ?? null,
    }));
  }

  // Scoring
  async calculateProctoringScore(sessionId: string): Promise<number> {
    const result = await query(
      `SELECT COALESCE(SUM(penalty), 0) as total_penalty,
              COUNT(*) as violation_count,
              COUNT(DISTINCT violation_type) as unique_violation_types
       FROM proctoring_logs
       WHERE session_id = $1`,
      [sessionId],
    );

    const { total_penalty, violation_count, unique_violation_types } = result.rows[0];

    let score = 100;

    score -= Math.min(parseInt(total_penalty, 10), 60);
    score -= Math.min(parseInt(violation_count, 10) * 2, 30);
    score -= Math.min(parseInt(unique_violation_types, 10) * 3, 15);

    const mlResult = await query(
      `SELECT SUM(violations_detected) as ml_violations
       FROM ml_analysis_results
       WHERE session_id = $1`,
      [sessionId],
    );

    const mlViolations = parseInt(mlResult.rows[0]?.ml_violations ?? 0, 10);
    score -= mlViolations * 4;

    return Math.max(0, Math.floor(score));
  }

  async getSessionDetails(
    sessionId: string,
    requesterUserId: string,
    isAdmin = false,
  ): Promise<any> {
    const sessionResult = await query(
      `SELECT ps.*, 
              u.name as user_name,
              u.email as user_email,
              c.title as challenge_title
       FROM proctoring_sessions ps
       LEFT JOIN users u ON ps.user_id = u.id
       LEFT JOIN challenges c ON ps.challenge_id = c.id
       WHERE ps.id = $1
         AND ($2::boolean = true OR ps.user_id = $3)`,
      [sessionId, isAdmin, requesterUserId],
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];
    if (isAdmin && session.user_id && session.user_id !== requesterUserId) {
      await this.recordSensitiveAccess(requesterUserId, session.user_id, sessionId);
    }
    const [violations, mlAnalyses, score, eventAggResult, snapshotAggResult, reviewResult] = await Promise.all([
      this.getSessionViolations(sessionId),
      this.getMLAnalysisResults(sessionId),
      this.calculateProctoringScore(sessionId),
      query(
        `SELECT event_type, severity, COUNT(*)::int as count
         FROM proctoring_event_logs
         WHERE session_id = $1
         GROUP BY event_type, severity`,
        [sessionId],
      ),
      query(
        `SELECT COUNT(*)::int as count, COALESCE(SUM(bytes), 0)::int as total_bytes
         FROM proctoring_snapshots
         WHERE session_id = $1`,
        [sessionId],
      ),
      query(
        `SELECT status, final_risk_score, reasons_json, reviewed_at, created_at
         FROM proctoring_reviews
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [sessionId],
      ),
    ]);

    const violationStats = {
      total: violations.length,
      bySeverity: {
        high: violations.filter((v: any) => v.severity === 'high').length,
        medium: violations.filter((v: any) => v.severity === 'medium').length,
        low: violations.filter((v: any) => v.severity === 'low').length,
      },
      byType: violations.reduce(
        (acc: any, violation: any) => {
          acc[violation.violation_type] = (acc[violation.violation_type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    const mlStats = {
      total: mlAnalyses.length,
      byType: mlAnalyses.reduce(
        (acc: any, analysis: any) => {
          acc[analysis.analysis_type] = (acc[analysis.analysis_type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    const eventStats = {
      total: eventAggResult.rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
      byType: eventAggResult.rows.reduce((acc: Record<string, number>, row) => {
        acc[row.event_type] = Number(row.count ?? 0);
        return acc;
      }, {}),
      bySeverity: eventAggResult.rows.reduce((acc: Record<string, number>, row) => {
        const severity = String(row.severity ?? 'low');
        acc[severity] = (acc[severity] ?? 0) + Number(row.count ?? 0);
        return acc;
      }, {}),
    };

    const snapshotStats = {
      total: Number(snapshotAggResult.rows[0]?.count ?? 0),
      totalBytes: Number(snapshotAggResult.rows[0]?.total_bytes ?? 0),
    };

    return {
      session,
      violations,
      mlAnalyses,
      proctoringScore: score,
      review:
        reviewResult.rows.length > 0
          ? {
              status: reviewResult.rows[0].status,
              final_risk_score: Number(reviewResult.rows[0].final_risk_score ?? 0),
              reasons:
                typeof reviewResult.rows[0].reasons_json === 'string'
                  ? JSON.parse(reviewResult.rows[0].reasons_json)
                  : reviewResult.rows[0].reasons_json ?? {},
              reviewed_at: reviewResult.rows[0].reviewed_at
                ? new Date(reviewResult.rows[0].reviewed_at).toISOString()
                : null,
            }
          : null,
      stats: {
        violations: violationStats,
        mlAnalyses: mlStats,
        events: eventStats,
        snapshots: snapshotStats,
      },
      duration: session.end_time
        ? this.calculateDuration(session.start_time, session.end_time)
        : this.calculateDuration(session.start_time, new Date().toISOString()),
    };
  }

  private calculateDuration(startTime: string, endTime: string): string {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  }

  // Utility Methods
  async getUserSessions(userId: string, limit: number = 10): Promise<any[]> {
    const result = await query(
      `SELECT ps.*, 
              c.title as challenge_title,
              (SELECT COUNT(*) FROM proctoring_logs pl WHERE pl.session_id = ps.id) as violation_count,
              (SELECT COALESCE(SUM(penalty), 0) FROM proctoring_logs pl WHERE pl.session_id = ps.id) as total_penalty
       FROM proctoring_sessions ps
       LEFT JOIN challenges c ON ps.challenge_id = c.id
       WHERE ps.user_id = $1
       ORDER BY ps.start_time DESC
       LIMIT $2`,
      [userId, limit],
    );

    return result.rows;
  }

  async getRecentSessions(limit: number = 20): Promise<any[]> {
    const result = await query(
      `SELECT ps.*, 
              u.name as user_name,
              u.email as user_email,
              c.title as challenge_title,
              (SELECT COUNT(*) FROM proctoring_logs pl WHERE pl.session_id = ps.id) as violation_count,
              (SELECT COALESCE(SUM(penalty), 0) FROM proctoring_logs pl WHERE pl.session_id = ps.id) as total_penalty
       FROM proctoring_sessions ps
       LEFT JOIN users u ON ps.user_id = u.id
       LEFT JOIN challenges c ON ps.challenge_id = c.id
       ORDER BY ps.start_time DESC
       LIMIT $1`,
      [limit],
    );

    return result.rows;
  }

  async getViolationSummary(startDate?: string, endDate?: string): Promise<any> {
    let sql = `
      SELECT violation_type, severity, COUNT(*) as count, SUM(penalty) as total_penalty
      FROM proctoring_logs
    `;

    const params: unknown[] = [];

    if (startDate || endDate) {
      const conditions: string[] = [];
      if (startDate) {
        conditions.push(`timestamp >= $${params.length + 1}`);
        params.push(startDate);
      }
      if (endDate) {
        conditions.push(`timestamp <= $${params.length + 1}`);
        params.push(endDate);
      }
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` GROUP BY violation_type, severity ORDER BY count DESC`;

    const result = await query(sql, params);

    const summary = {
      totalViolations: result.rows.reduce(
        (sum: number, row: any) => sum + parseInt(row.count, 10),
        0,
      ),
      totalPenalty: result.rows.reduce(
        (sum: number, row: any) => sum + parseInt(row.total_penalty, 10),
        0,
      ),
      byType: result.rows.reduce((acc: any, row: any) => {
        if (!acc[row.violation_type]) {
          acc[row.violation_type] = {
            count: 0,
            penalty: 0,
            severity: row.severity,
          };
        }
        acc[row.violation_type].count += parseInt(row.count, 10);
        acc[row.violation_type].penalty += parseInt(row.total_penalty, 10);
        return acc;
      }, {}),
      bySeverity: result.rows.reduce((acc: any, row: any) => {
        if (!acc[row.severity]) {
          acc[row.severity] = { count: 0, penalty: 0 };
        }
        acc[row.severity].count += parseInt(row.count, 10);
        acc[row.severity].penalty += parseInt(row.total_penalty, 10);
        return acc;
      }, {}),
    };

    return summary;
  }

  async getUserViolationSummary(userId: string): Promise<any> {
    const result = await query(
      `
      SELECT violation_type, severity, COUNT(*) as count, SUM(penalty) as total_penalty
      FROM proctoring_logs
      WHERE user_id = $1
      GROUP BY violation_type, severity
      ORDER BY count DESC
    `,
      [userId],
    );

    return {
      totalViolations: result.rows.reduce(
        (sum: number, row: any) => sum + parseInt(row.count, 10),
        0,
      ),
      totalPenalty: result.rows.reduce(
        (sum: number, row: any) => sum + parseInt(row.total_penalty, 10),
        0,
      ),
      byType: result.rows.reduce((acc: any, row: any) => {
        acc[row.violation_type] = (acc[row.violation_type] || 0) + parseInt(row.count, 10);
        return acc;
      }, {}),
    };
  }

  async getSessionAnalytics(
    sessionId: string,
    requesterUserId: string,
    isAdmin = false,
  ): Promise<{
    violationTimeline: Array<{ timestamp: string; count: number }>;
    severityDistribution: { high: number; medium: number; low: number };
    peakViolationTime: string | null;
  }> {
    const authorizedSession = await query(
      `SELECT id
       FROM proctoring_sessions
       WHERE id = $1
         AND ($2::boolean = true OR user_id = $3)`,
      [sessionId, isAdmin, requesterUserId],
    );
    if (authorizedSession.rows.length === 0) {
      throw new Error('Session not found');
    }

    const result = await query(
      `
      SELECT date_trunc('minute', timestamp) as minute_bucket,
             COUNT(*) as count,
             SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
             SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
             SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_count
      FROM proctoring_logs
      WHERE session_id = $1
      GROUP BY minute_bucket
      ORDER BY minute_bucket
    `,
      [sessionId],
    );

    const violationTimeline = result.rows.map((row: any) => ({
      timestamp: row.minute_bucket.toISOString(),
      count: Number(row.count),
    }));

    let high = 0;
    let medium = 0;
    let low = 0;
    let peakViolationTime: string | null = null;
    let peakCount = 0;

    for (const row of result.rows) {
      high += Number(row.high_count);
      medium += Number(row.medium_count);
      low += Number(row.low_count);

      const count = Number(row.count);
      if (count > peakCount) {
        peakCount = count;
        peakViolationTime = row.minute_bucket.toISOString();
      }
    }

    return {
      violationTimeline,
      severityDistribution: { high, medium, low },
      peakViolationTime,
    };
  }

  async getSessionStatus(
    sessionId: string,
    requesterUserId: string,
    isAdmin = false,
  ): Promise<{
    isActive: boolean;
    isPaused: boolean;
    status: 'active' | 'paused' | 'completed';
    pauseReason: string | null;
    heartbeatAt: string | null;
    isHeartbeatStale: boolean;
    violationsSinceLastCheck: number;
    currentScore: number;
    riskState: RiskState;
  }> {
    await this.ensureSessionSchemaExtensions();

    const sessionResult = await query(
      `SELECT id, user_id, status, pause_reason, heartbeat_at, risk_state
       FROM proctoring_sessions
       WHERE id = $1
         AND ($2::boolean = true OR user_id = $3)`,
      [sessionId, isAdmin, requesterUserId],
    );

    if (sessionResult.rows.length === 0) {
      return {
        isActive: false,
        isPaused: false,
        status: 'completed',
        pauseReason: null,
        heartbeatAt: null,
        isHeartbeatStale: false,
        violationsSinceLastCheck: 0,
        currentScore: 0,
        riskState: 'observe',
      };
    }

    const session = sessionResult.rows[0];
    let status = session.status as 'active' | 'paused' | 'completed';
    let pauseReason: string | null = session.pause_reason ?? null;

    const heartbeatAtDate = session.heartbeat_at ? new Date(session.heartbeat_at) : null;
    const heartbeatAgeSeconds = heartbeatAtDate
      ? (Date.now() - heartbeatAtDate.getTime()) / 1000
      : Number.POSITIVE_INFINITY;
    let isHeartbeatStale =
      status === 'active' && heartbeatAgeSeconds > this.heartbeatTimeoutSeconds;

    if (isHeartbeatStale) {
      const paused = await this.pauseSession(
        sessionId,
        session.user_id,
        'Heartbeat timeout: proctoring heartbeat lost',
      );
      await this.logViolation(
        sessionId,
        session.user_id,
        'heartbeat_timeout',
        'Heartbeat timeout detected - session auto-paused',
      );
      status = paused.status;
      pauseReason = paused.pauseReason;
      isHeartbeatStale = false;
    }

    const violationsResult = await query(
      `SELECT COUNT(*) as count FROM proctoring_logs WHERE session_id = $1`,
      [sessionId],
    );

    const currentScore = await this.calculateProctoringScore(sessionId);

    return {
      isActive: status === 'active',
      isPaused: status === 'paused',
      status,
      pauseReason,
      heartbeatAt: heartbeatAtDate ? heartbeatAtDate.toISOString() : null,
      isHeartbeatStale,
      violationsSinceLastCheck: parseInt(violationsResult.rows[0]?.count ?? 0, 10),
      currentScore,
      riskState:
        status === 'paused'
          ? 'paused'
          : session.risk_state === 'warn' || session.risk_state === 'elevated' || session.risk_state === 'paused'
            ? session.risk_state
            : 'observe',
    };
  }

  async getSessionRisk(
    sessionId: string,
    userId: string,
  ): Promise<{
    risk_state: RiskState;
    risk_score: number;
    pause_recommended: boolean;
    liveness_required: boolean;
    reasons: string[];
  }> {
    await this.ensureSessionSchemaExtensions();

    const sessionResult = await query(
      `SELECT id, status, liveness_required
       FROM proctoring_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const risk = await this.computeRiskForSession(sessionId);
    await this.persistSessionRiskState(sessionId, risk);

    const status = String(sessionResult.rows[0].status ?? 'active');
    const computedState: RiskState =
      status === 'paused' && risk.riskState !== 'paused' ? 'paused' : risk.riskState;

    return {
      risk_state: computedState,
      risk_score: risk.riskScore,
      pause_recommended: risk.pauseRecommended,
      liveness_required: Boolean(sessionResult.rows[0].liveness_required ?? risk.livenessRequired),
      reasons: risk.reasons,
    };
  }

  async requestLivenessChallenge(
    sessionId: string,
    userId: string,
  ): Promise<{
    required: boolean;
    challenge_id: string;
    expected_action: 'turn_left' | 'turn_right' | 'look_up' | 'look_down' | 'blink_once';
    prompt: string;
    expires_at: string;
  }> {
    await this.ensureSessionSchemaExtensions();

    const sessionResult = await query(
      `SELECT id, status
       FROM proctoring_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }
    if (sessionResult.rows[0].status === 'completed') {
      throw new Error('Completed sessions cannot request liveness checks');
    }

    const challenge = this.createLivenessChallenge();
    await query(
      `UPDATE proctoring_sessions
       SET liveness_required = true,
           liveness_challenge = $3::jsonb
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId, JSON.stringify(challenge)],
    );

    return {
      required: true,
      challenge_id: challenge.challenge_id,
      expected_action: challenge.expected_action,
      prompt: challenge.prompt,
      expires_at: challenge.expires_at,
    };
  }

  async verifyLivenessChallenge(
    sessionId: string,
    userId: string,
    responseAction: string,
  ): Promise<{
    verified: boolean;
    message: string;
    risk_state: RiskState;
    liveness_required: boolean;
  }> {
    await this.ensureSessionSchemaExtensions();

    const sessionResult = await query(
      `SELECT status, pause_reason, liveness_challenge, liveness_required
       FROM proctoring_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];
    const challengePayload =
      typeof session.liveness_challenge === 'string'
        ? JSON.parse(session.liveness_challenge)
        : session.liveness_challenge ?? {};

    const expectedAction = String(challengePayload.expected_action || '').trim();
    const expiresAt = new Date(String(challengePayload.expires_at || '')).getTime();
    const normalizedResponse = String(responseAction || '').trim();

    if (!expectedAction || !expiresAt || Number.isNaN(expiresAt)) {
      throw new Error('No active liveness challenge');
    }

    if (Date.now() > expiresAt) {
      return {
        verified: false,
        message: 'Liveness challenge expired. Request a new one.',
        risk_state: 'paused',
        liveness_required: true,
      };
    }

    if (normalizedResponse !== expectedAction) {
      return {
        verified: false,
        message: 'Liveness verification failed. Please try again.',
        risk_state: 'paused',
        liveness_required: true,
      };
    }

    await query(
      `UPDATE proctoring_sessions
       SET liveness_required = false,
           liveness_completed_at = NOW(),
           liveness_challenge = '{}'::jsonb,
           risk_state = 'observe'
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );

    if (
      String(session.status) === 'paused' &&
      typeof session.pause_reason === 'string' &&
      session.pause_reason.startsWith('Consensus risk pause:')
    ) {
      await this.resumeSession(sessionId, userId).catch(() => undefined);
    }

    return {
      verified: true,
      message: 'Liveness verified. You can continue.',
      risk_state: 'observe',
      liveness_required: false,
    };
  }

  async enqueueSessionReview(sessionId: string): Promise<{ queued: boolean }> {
    await this.ensureSessionSchemaExtensions();
    setImmediate(() => {
      void this.runPostExamReview(sessionId);
    });
    return { queued: true };
  }

  async purgeExpiredEvidence(): Promise<{ deleted_snapshots: number }> {
    await this.ensureSessionSchemaExtensions();
    const deleted = await query(
      `DELETE FROM proctoring_snapshots
       WHERE expires_at IS NOT NULL
         AND expires_at <= NOW()`,
    );
    return { deleted_snapshots: Number(deleted.rowCount ?? 0) };
  }

  getDefaultSettings(): ProctoringSettings {
    return {
      requireCamera: true,
      requireMicrophone: true,
      requireAudio: true,
      strictMode: false,
      allowedViolationsBeforeWarning: 3,
      autoPauseOnViolation: false,
    };
  }

  async getSettingsForUser(_userId: string): Promise<ProctoringSettings> {
    const base = this.getDefaultSettings();
    const result = await query(
      `SELECT require_camera, require_microphone, require_audio, strict_mode,
              allowed_violations_before_warning, auto_pause_on_violation
       FROM proctoring_settings
       ORDER BY updated_at DESC
       LIMIT 1`,
    );

    if (result.rows.length === 0) {
      return base;
    }

    const row = result.rows[0];
    return {
      requireCamera: Boolean(row.require_camera),
      requireMicrophone: Boolean(row.require_microphone),
      requireAudio: Boolean(row.require_audio),
      strictMode: Boolean(row.strict_mode),
      allowedViolationsBeforeWarning: Number(
        row.allowed_violations_before_warning ?? base.allowedViolationsBeforeWarning,
      ),
      autoPauseOnViolation: Boolean(row.auto_pause_on_violation),
    };
  }

  async updateSettingsForUser(
    userId: string,
    _settings: Partial<ProctoringSettings>,
  ): Promise<ProctoringSettings> {
    const current = await this.getSettingsForUser(userId);
    const merged = { ...current, ..._settings };

    const existingResult = await query(`SELECT id FROM proctoring_settings ORDER BY updated_at DESC LIMIT 1`);
    if (existingResult.rows.length === 0) {
      await query(
        `INSERT INTO proctoring_settings
           (require_camera, require_microphone, require_audio, strict_mode, allowed_violations_before_warning, auto_pause_on_violation, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          merged.requireCamera,
          merged.requireMicrophone,
          merged.requireAudio,
          merged.strictMode,
          merged.allowedViolationsBeforeWarning,
          merged.autoPauseOnViolation,
          userId,
        ],
      );
    } else {
      await query(
        `UPDATE proctoring_settings
         SET require_camera = $2,
             require_microphone = $3,
             require_audio = $4,
             strict_mode = $5,
             allowed_violations_before_warning = $6,
             auto_pause_on_violation = $7,
             updated_by = $8,
             updated_at = NOW()
         WHERE id = $1`,
        [
          existingResult.rows[0].id,
          merged.requireCamera,
          merged.requireMicrophone,
          merged.requireAudio,
          merged.strictMode,
          merged.allowedViolationsBeforeWarning,
          merged.autoPauseOnViolation,
          userId,
        ],
      );
    }

    return merged;
  }

  // Health Check
  async healthCheck(): Promise<ProctoringHealthSnapshot> {
    await this.ensureSessionSchemaExtensions();

    const health: ProctoringHealthSnapshot = {
      database: false,
      mlService: false,
      capabilities: {
        face_live: false,
        audio_live: false,
        deep_review_available: true,
        browser_consensus: true,
      },
      degraded_reasons: [],
    };

    try {
      await query('SELECT 1');
      health.database = true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      health.degraded_reasons.push('database_unavailable');
    }

    try {
      const payload = (await this.mlServiceAdapter.health()) ?? {};
      const payloadFlags =
        payload && typeof payload.flags === 'object' && payload.flags !== null
          ? (payload.flags as Record<string, unknown>)
          : {};
      const enableFaceDetector = payloadFlags.enable_face_detector !== false;
      const enableAudioAnalyzer = payloadFlags.enable_audio_analyzer === true;
      const enableObjectDetector = payloadFlags.enable_object_detector === true;
      const payloadCapabilities =
        payload && typeof payload.capabilities === 'object' && payload.capabilities !== null
          ? (payload.capabilities as Record<string, unknown>)
          : {};
      const payloadDetectors =
        payload && typeof payload.detectors === 'object' && payload.detectors !== null
          ? (payload.detectors as Record<string, unknown>)
          : {};
      health.mlService = true;
      health.capabilities.face_live = Boolean(payloadCapabilities.face_live ?? payloadDetectors.face);
      health.capabilities.audio_live = Boolean(payloadCapabilities.audio_live ?? payloadDetectors.audio);
      health.capabilities.deep_review_available = Boolean(
        payloadCapabilities.deep_review_available ?? health.capabilities.deep_review_available,
      );

      const degraded = Array.isArray(payload?.degraded_reasons)
        ? payload.degraded_reasons.filter((reason: unknown) => {
            if (typeof reason !== 'string') {
              return false;
            }
            if (reason === 'face_detector_unavailable' && !enableFaceDetector) {
              return false;
            }
            if (reason === 'audio_detector_unavailable' && !enableAudioAnalyzer) {
              return false;
            }
            if (reason === 'object_detector_unavailable' && !enableObjectDetector) {
              return false;
            }
            return true;
          })
        : [];
      if (degraded.length > 0) {
        health.degraded_reasons.push(...degraded);
      }
      if (enableFaceDetector && !health.capabilities.face_live) {
        health.degraded_reasons.push('face_detector_unavailable');
      }
      if (enableAudioAnalyzer && !health.capabilities.audio_live) {
        health.degraded_reasons.push('audio_detector_unavailable');
      }
    } catch (error) {
      logger.error('ML service health check failed', { error });
      health.degraded_reasons.push('ml_service_unavailable');
    }

    await query(
      `INSERT INTO proctoring_detector_health
         (detector_name, status, degraded_reasons, details)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
      [
        'ml_service',
        health.mlService ? 'healthy' : 'degraded',
        JSON.stringify(Array.from(new Set(health.degraded_reasons))),
        JSON.stringify({
          face_live: health.capabilities.face_live,
          audio_live: health.capabilities.audio_live,
          browser_consensus: health.capabilities.browser_consensus,
        }),
      ],
    ).catch(() => undefined);

    health.degraded_reasons = Array.from(new Set(health.degraded_reasons));
    return health;
  }
}
