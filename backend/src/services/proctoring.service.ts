import { query } from '../db';
import axios from 'axios';
import { config } from '../config';
import { getViolationPenalty, normalizeViolationType } from '../constants/violationPenalties';

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

export interface ProctoringEventInput {
  event_type: string;
  severity: 'low' | 'medium' | 'high';
  payload?: Record<string, unknown>;
  timestamp?: string;
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

  private readonly mlServiceUrl: string;
  private schemaEnsured = false;
  private readonly heartbeatTimeoutSeconds = 15;

  constructor() {
    this.mlServiceUrl = config.ML_SERVICE_URL || 'http://localhost:5000';
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
         ADD COLUMN IF NOT EXISTS total_paused_seconds INTEGER DEFAULT 0`,
    );

    await query(
      `CREATE TABLE IF NOT EXISTS proctoring_event_logs (
         id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
         session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
         user_id UUID REFERENCES users(id) ON DELETE CASCADE,
         event_type VARCHAR(100) NOT NULL,
         severity VARCHAR(20) NOT NULL DEFAULT 'low',
         payload JSONB NOT NULL DEFAULT '{}'::jsonb,
         created_at TIMESTAMP DEFAULT NOW()
       )`,
    );

    await query(
      `CREATE TABLE IF NOT EXISTS proctoring_snapshots (
         id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
         session_id UUID REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
         user_id UUID REFERENCES users(id) ON DELETE CASCADE,
         trigger_type VARCHAR(100) NOT NULL,
         image_data BYTEA NOT NULL,
         bytes INTEGER NOT NULL,
         metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
         created_at TIMESTAMP DEFAULT NOW()
       )`,
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

    this.schemaEnsured = true;
  }

  // Session Management
  async startSession(userId: string, challengeId: string): Promise<ProctoringSessionStartResult> {
    await this.ensureSessionSchemaExtensions();

    const challengeResult = await query(
      `SELECT duration_minutes
       FROM challenges
       WHERE id = $1`,
      [challengeId],
    );
    const durationMinutes = Number(challengeResult.rows[0]?.duration_minutes ?? 45);
    const durationSeconds = Math.max(300, durationMinutes * 60);
    const deadlineAt = new Date(Date.now() + durationSeconds * 1000);

    let result;
    try {
      result = await query(
        `INSERT INTO proctoring_sessions
           (user_id, challenge_id, start_time, status, heartbeat_at, deadline_at, duration_seconds, paused_at, pause_reason, pause_count, total_paused_seconds)
         VALUES ($1, $2, NOW(), 'active', NOW(), $3, $4, NULL, NULL, 0, 0)
         RETURNING id`,
        [userId, challengeId, deadlineAt.toISOString(), durationSeconds],
      );
    } catch {
      // Fallback for older schemas that haven't applied extension columns yet.
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

  async endSession(sessionId: string, submissionId?: string): Promise<void> {
    await this.ensureSessionSchemaExtensions();
    await query(
      `UPDATE proctoring_sessions 
       SET end_time = NOW(), 
            status = 'completed',
            paused_at = NULL,
            pause_reason = NULL,
            submission_id = $2
       WHERE id = $1`,
      [sessionId, submissionId ?? null],
    );

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
      `SELECT status, paused_at
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
      `SELECT status, paused_at
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

    const pausedAtValue = current.paused_at ? new Date(current.paused_at) : null;
    const pausedDurationSeconds = pausedAtValue
      ? Math.max(0, Math.floor((Date.now() - pausedAtValue.getTime()) / 1000))
      : 0;

    const updated = await query(
      `UPDATE proctoring_sessions
       SET status = 'active',
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
      payload.microphoneReady === false ||
      payload.audioReady === false;

    if (missingRequiredDevice) {
      const reasonParts: string[] = [];
      if (!payload.cameraReady) reasonParts.push('camera');
      if (!payload.microphoneReady) reasonParts.push('microphone');
      if (!payload.audioReady) reasonParts.push('audio');
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
  ): Promise<{ accepted: number; status: 'active' | 'paused' | 'completed' }> {
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

    const validEvents = events
      .slice(0, MAX_EVENTS_PER_BATCH)
      .filter((event) => typeof event.event_type === 'string' && event.event_type.trim().length > 0)
      .map((event) => ({
        eventType: normalizeViolationType(event.event_type),
        severity:
          event.severity === 'high' || event.severity === 'medium' || event.severity === 'low'
            ? event.severity
            : 'low',
        payload: event.payload ?? {},
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      }))
      .filter((event) => !Number.isNaN(event.timestamp.getTime()));

    for (const event of validEvents) {
      await query(
        `INSERT INTO proctoring_event_logs
           (session_id, user_id, event_type, severity, payload, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          sessionId,
          userId,
          event.eventType,
          event.severity,
          JSON.stringify(event.payload),
          event.timestamp.toISOString(),
        ],
      );
    }

    return {
      accepted: validEvents.length,
      status: sessionResult.rows[0].status,
    };
  }

  async storeSnapshot(
    sessionId: string,
    userId: string,
    triggerType: string,
    imageBuffer: Buffer,
    metadata: Record<string, unknown> = {},
  ): Promise<{ snapshot_id: string; bytes: number }> {
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

    const result = await query(
      `INSERT INTO proctoring_snapshots
         (session_id, user_id, trigger_type, image_data, bytes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, bytes`,
      [
        sessionId,
        userId,
        normalizeViolationType(triggerType || 'sampled_snapshot'),
        imageBuffer,
        imageBuffer.length,
        JSON.stringify(metadata ?? {}),
      ],
    );

    await query(
      `INSERT INTO proctoring_event_logs
         (session_id, user_id, event_type, severity, payload)
       VALUES ($1, $2, 'snapshot_captured', 'low', $3::jsonb)`,
      [
        sessionId,
        userId,
        JSON.stringify({
          trigger_type: normalizeViolationType(triggerType || 'sampled_snapshot'),
          bytes: imageBuffer.length,
        }),
      ],
    );

    return {
      snapshot_id: result.rows[0].id,
      bytes: Number(result.rows[0].bytes),
    };
  }

  private async runPostExamReview(sessionId: string): Promise<void> {
    try {
      await this.ensureSessionSchemaExtensions();

      const [eventsResult, snapshotsResult] = await Promise.all([
        query(
          `SELECT severity, event_type
           FROM proctoring_event_logs
           WHERE session_id = $1`,
          [sessionId],
        ),
        query(
          `SELECT trigger_type, bytes
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
          top_events: eventsResult.rows
            .reduce<Record<string, number>>((acc, row) => {
              const type = String(row.event_type);
              acc[type] = (acc[type] ?? 0) + 1;
              return acc;
            }, {}),
        },
        [],
      );
    } catch (error) {
      console.error('Post-exam proctoring review failed:', error);
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

      // Create FormData-like structure for multipart upload
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('image', imageBuffer, {
        filename: 'frame.jpg',
        contentType: 'image/jpeg',
      });

      // FastAPI expects form fields, not query params for multipart
      const response = await axios.post(
        `${this.mlServiceUrl}/api/analyze/face`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          params: {
            session_id: sessionId,
            timestamp,
            analysis_type: 'face',
          },
          timeout: 10_000,
        },
      );

      const mlResult = response.data;

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

      return {
        result: mlResult.results,
        violations,
      };
    } catch (error) {
      console.error('Face analysis failed:', error);
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

      // Create FormData-like structure for multipart upload
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });

      const response = await axios.post(
        `${this.mlServiceUrl}/api/analyze/audio`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          params: {
            session_id: sessionId,
            timestamp,
            analysis_type: 'audio',
            duration_ms: durationMs,
          },
          timeout: 15_000,
        },
      );

      const mlResult = response.data;

      if (!mlResult?.success) {
        throw new Error('Audio analysis failed');
      }

      await this.logMLAnalysis(
        sessionId,
        'audio',
        timestamp,
        mlResult.results,
        mlResult.violations || [],
      );

      const violations: ProctoringViolation[] = (mlResult.violations || []).map((mlViolation: any) =>
        this.mapMlViolation(mlViolation.type, mlViolation.description, mlViolation.confidence),
      );

      return {
        result: mlResult.results,
        violations,
      };
    } catch (error) {
      console.error('Audio analysis failed:', error);

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
    let sql = `SELECT * FROM ml_analysis_results WHERE session_id = $1`;
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

  async getSessionDetails(sessionId: string): Promise<any> {
    const sessionResult = await query(
      `SELECT ps.*, 
              u.name as user_name,
              u.email as user_email,
              c.title as challenge_title
       FROM proctoring_sessions ps
       LEFT JOIN users u ON ps.user_id = u.id
       LEFT JOIN challenges c ON ps.challenge_id = c.id
       WHERE ps.id = $1`,
      [sessionId],
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];
    const [violations, mlAnalyses, score, eventAggResult, snapshotAggResult] = await Promise.all([
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

  async getSessionAnalytics(sessionId: string): Promise<{
    violationTimeline: Array<{ timestamp: string; count: number }>;
    severityDistribution: { high: number; medium: number; low: number };
    peakViolationTime: string | null;
  }> {
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

  async getSessionStatus(sessionId: string): Promise<{
    isActive: boolean;
    isPaused: boolean;
    status: 'active' | 'paused' | 'completed';
    pauseReason: string | null;
    heartbeatAt: string | null;
    isHeartbeatStale: boolean;
    violationsSinceLastCheck: number;
    currentScore: number;
  }> {
    await this.ensureSessionSchemaExtensions();

    const sessionResult = await query(
      `SELECT id, user_id, status, pause_reason, heartbeat_at
       FROM proctoring_sessions
       WHERE id = $1`,
      [sessionId],
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
    };
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
  async healthCheck(): Promise<{ database: boolean; mlService: boolean }> {
    const health = {
      database: false,
      mlService: false,
    };

    try {
      await query('SELECT 1');
      health.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    try {
      await axios.get(`${this.mlServiceUrl}/health`, { timeout: 5000 });
      health.mlService = true;
    } catch (error) {
      console.error('ML service health check failed:', error);
    }

    return health;
  }
}
