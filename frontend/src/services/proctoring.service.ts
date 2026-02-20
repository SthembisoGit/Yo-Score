import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';

export interface ProctoringSession {
  sessionId: string;
  userId: string;
  challengeId: string;
  startTime: string;
  status: 'active' | 'paused' | 'completed';
}

export interface ProctoringSessionStartResponse {
  sessionId: string;
  deadline_at: string;
  duration_seconds: number;
}

export interface ProctoringViolation {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  penalty: number;
  timestamp: string;
  confidence?: number;
}

export interface ProctoringSessionDetails {
  session: ProctoringSession;
  violations: ProctoringViolation[];
  proctoringScore: number;
  violationCount: number;
  stats: {
    violations: {
      total: number;
      bySeverity: {
        high: number;
        medium: number;
        low: number;
      };
      byType: Record<string, number>;
    };
  };
  duration: string;
}

export interface FaceMonitorResult {
  face_count: number;
  face_box?: {
    x_center?: number;
    y_center?: number;
    width?: number;
    height?: number;
  };
  gaze_direction?: {
    looking_away?: boolean;
    direction?: string;
    confidence?: number;
  };
  eyes_closed: boolean;
  face_coverage: number;
  confidence: number;
  has_face: boolean;
}

export interface AudioMonitorResult {
  has_speech: boolean;
  speech_confidence: number;
  voice_count: number;
  noise_level: number;
  suspicious_keywords: string[];
  transcript: string;
  error?: string;
}

export interface SessionHeartbeatPayload {
  cameraReady: boolean;
  microphoneReady: boolean;
  audioReady: boolean;
  isPaused?: boolean;
  windowFocused?: boolean;
  timestamp?: string;
}

export interface SessionHeartbeatResponse {
  status: 'active' | 'paused' | 'completed';
  pauseReason: string | null;
  heartbeatAt: string;
}

export interface ProctoringEventInput {
  event_type: string;
  severity: 'low' | 'medium' | 'high';
  payload?: Record<string, unknown>;
  timestamp?: string;
}

class ProctoringService {
  /**
   * Start a new proctoring session
   */
  async startSession(challengeId: string): Promise<ProctoringSessionStartResponse> {
    try {
      const response = await apiClient.post('/proctoring/session/start', { challengeId });
      return unwrapData<ProctoringSessionStartResponse>(response);
    } catch {
      throw new Error('Could not start proctoring session');
    }
  }

  /**
   * End a proctoring session
   */
  async endSession(sessionId: string, submissionId?: string): Promise<void> {
    try {
      await apiClient.post('/proctoring/session/end', {
        sessionId,
        submissionId
      });
    } catch {
      // Do not block submission if proctoring end fails
    }
  }

  async pauseSession(sessionId: string, reason: string): Promise<{
    status: 'active' | 'paused' | 'completed';
    pauseReason: string | null;
    pausedAt: string | null;
  }> {
    const response = await apiClient.post('/proctoring/session/pause', { sessionId, reason });
    return unwrapData(response);
  }

  async resumeSession(sessionId: string): Promise<{
    status: 'active' | 'paused' | 'completed';
    pauseReason: string | null;
  }> {
    const response = await apiClient.post('/proctoring/session/resume', { sessionId });
    return unwrapData(response);
  }

  async sendHeartbeat(
    sessionId: string,
    payload: SessionHeartbeatPayload,
  ): Promise<SessionHeartbeatResponse> {
    const response = await apiClient.post('/proctoring/session/heartbeat', {
      sessionId,
      ...payload,
    });
    return unwrapData<SessionHeartbeatResponse>(response);
  }

  /**
   * Log a violation during a session
   */
  async logViolation(
    sessionId: string, 
    type: string, 
    description?: string
  ): Promise<ProctoringViolation> {
    const response = await apiClient.post('/proctoring/violation', {
      sessionId,
      type,
      description: description || `Violation: ${type}`
    });
    
    return unwrapData<ProctoringViolation>(response);
  }

  /**
   * Get details of a specific session
   */
  async getSessionDetails(sessionId: string): Promise<ProctoringSessionDetails> {
    try {
      const response = await apiClient.get(`/proctoring/session/${sessionId}`);
      return unwrapData<ProctoringSessionDetails>(response);
    } catch {
      throw new Error('Could not retrieve session details');
    }
  }

  /**
   * Get user's recent proctoring sessions
   */
  async getUserSessions(userId: string, limit: number = 10): Promise<ProctoringSession[]> {
    const response = await apiClient.get(`/proctoring/user/${userId}/sessions?limit=${limit}`);
    return unwrapData<ProctoringSession[]>(response);
  }

  /**
   * Get violation summary for a user
   */
  async getUserViolationSummary(userId: string): Promise<{
    totalViolations: number;
    totalPenalty: number;
    byType: Record<string, number>;
  }> {
    const response = await apiClient.get(`/proctoring/user/${userId}/violations/summary`);
    return unwrapData(response);
  }

  /**
   * Check if proctoring service is available
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string; degraded?: boolean }> {
    try {
      const response = await apiClient.get('/proctoring/health');
      const data = unwrapData<{ database: boolean; mlService: boolean }>(response);
      const degraded = !data.mlService;
      return {
        status: data.database ? 'healthy' : 'unhealthy',
        message: degraded
          ? 'Proctoring API is available but ML analysis is degraded.'
          : 'Proctoring service is available',
        degraded
      };
    } catch {
      return {
        status: 'unhealthy',
        message: 'Proctoring service is temporarily unavailable',
        degraded: false
      };
    }
  }

  /**
   * Batch log multiple violations
   */
  async logMultipleViolations(
    sessionId: string,
    violations: Array<{ type: string; description?: string }>
  ): Promise<ProctoringViolation[]> {
    const response = await apiClient.post('/proctoring/violations/batch', { sessionId, violations });
    return unwrapData<ProctoringViolation[]>(response);
  }

  /**
   * Get session analytics for dashboard
   */
  async getSessionAnalytics(sessionId: string): Promise<{
    violationTimeline: Array<{ timestamp: string; count: number }>;
    severityDistribution: { high: number; medium: number; low: number };
    peakViolationTime: string | null;
  }> {
    const response = await apiClient.get(`/proctoring/session/${sessionId}/analytics`);
    return unwrapData(response);
  }

  /**
   * Upload frame for ML analysis
   */
  async analyzeFrame(sessionId: string, frame: Blob): Promise<FaceMonitorResult | null> {
    try {
      const arrayBuffer = await frame.arrayBuffer();
      const response = await apiClient.post(
        `/proctoring/analyze-face?sessionId=${sessionId}&timestamp=${encodeURIComponent(new Date().toISOString())}`,
        arrayBuffer,
        {
          headers: {
            'Content-Type': 'image/jpeg',
          },
        }
      );

      const payload = unwrapData<Record<string, unknown>>(response);
      const wrappedResult =
        ((payload.result as Record<string, unknown> | undefined) ||
          (payload.results as Record<string, unknown> | undefined) ||
          payload);

      return {
        face_count: Number(wrappedResult.face_count ?? wrappedResult.faceCount ?? 0),
        face_box:
          (wrappedResult.face_box as FaceMonitorResult['face_box']) ||
          (wrappedResult.faceBox as FaceMonitorResult['face_box']),
        gaze_direction:
          (wrappedResult.gaze_direction as FaceMonitorResult['gaze_direction']) ||
          (wrappedResult.gazeDirection as FaceMonitorResult['gaze_direction']),
        eyes_closed: Boolean(wrappedResult.eyes_closed ?? wrappedResult.eyesClosed ?? false),
        face_coverage: Number(wrappedResult.face_coverage ?? wrappedResult.faceCoverage ?? 0),
        confidence: Number(wrappedResult.confidence ?? 0),
        has_face: Boolean(wrappedResult.has_face ?? wrappedResult.hasFace ?? false),
      };
    } catch (error) {
      console.error('Frame analysis failed:', error);
      return null;
    }
  }

  /**
   * Upload audio for ML analysis
   */
  async analyzeAudio(sessionId: string, audio: Blob, durationMs: number): Promise<AudioMonitorResult | null> {
    try {
      const arrayBuffer = await audio.arrayBuffer();
      const response = await apiClient.post(
        `/proctoring/analyze-audio?sessionId=${sessionId}&timestamp=${encodeURIComponent(new Date().toISOString())}&durationMs=${durationMs}`,
        arrayBuffer,
        {
          headers: {
            'Content-Type': 'audio/webm',
          },
        }
      );

      const payload = unwrapData<Record<string, unknown>>(response);
      const wrappedResult =
        ((payload.result as Record<string, unknown> | undefined) ||
          (payload.results as Record<string, unknown> | undefined) ||
          payload);

      return {
        has_speech: Boolean(wrappedResult.has_speech ?? wrappedResult.hasSpeech ?? false),
        speech_confidence: Number(wrappedResult.speech_confidence ?? wrappedResult.speechConfidence ?? 0),
        voice_count: Number(wrappedResult.voice_count ?? wrappedResult.voiceCount ?? 0),
        noise_level: Number(wrappedResult.noise_level ?? wrappedResult.noiseLevel ?? 0),
        suspicious_keywords: Array.isArray(wrappedResult.suspicious_keywords)
          ? (wrappedResult.suspicious_keywords as string[])
          : [],
        transcript: String(wrappedResult.transcript ?? ''),
        error:
          typeof wrappedResult.error === 'string'
            ? wrappedResult.error
            : undefined,
      };
    } catch (error) {
      console.error('Audio analysis failed:', error);
      return null;
    }
  }

  /**
   * Get real-time session status
   */
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
    const response = await apiClient.get(`/proctoring/session/${sessionId}/status`);
    return unwrapData(response);
  }

  /**
   * Get proctoring settings for the current user
   */
  async getSettings(): Promise<{
    requireCamera: boolean;
    requireMicrophone: boolean;
    requireAudio: boolean;
    strictMode: boolean;
    allowedViolationsBeforeWarning: number;
    autoPauseOnViolation: boolean;
  }> {
    const response = await apiClient.get('/proctoring/settings');
    return unwrapData(response);
  }

  /**
   * Update proctoring settings
   */
  async updateSettings(settings: Partial<{
    requireCamera: boolean;
    requireMicrophone: boolean;
    requireAudio: boolean;
    strictMode: boolean;
    allowedViolationsBeforeWarning: number;
    autoPauseOnViolation: boolean;
  }>): Promise<void> {
    try {
      await apiClient.put('/proctoring/settings', settings);
    } catch {
      throw new Error('Could not update settings');
    }
  }

  async batchEvents(
    sessionId: string,
    events: ProctoringEventInput[],
  ): Promise<{ accepted: number; status: 'active' | 'paused' | 'completed' }> {
    const response = await apiClient.post('/proctoring/events/batch', {
      session_id: sessionId,
      events,
    });
    return unwrapData(response);
  }

  async uploadSnapshot(
    sessionId: string,
    snapshot: Blob,
    triggerType: string,
    metadata: Record<string, unknown> = {},
  ): Promise<{ snapshot_id: string; bytes: number }> {
    const arrayBuffer = await snapshot.arrayBuffer();
    const response = await apiClient.post(
      `/proctoring/session/${sessionId}/snapshot?trigger_type=${encodeURIComponent(
        triggerType,
      )}`,
      arrayBuffer,
      {
        headers: {
          'Content-Type': 'image/jpeg',
          'X-Proctoring-Metadata': encodeURIComponent(JSON.stringify(metadata)),
        },
      },
    );
    return unwrapData(response);
  }
}

export const proctoringService = new ProctoringService();
export default proctoringService;
