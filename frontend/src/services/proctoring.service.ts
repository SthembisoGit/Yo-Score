import apiClient from './apiClient';
import { unwrapData } from '@/lib/apiHelpers';

export interface ProctoringSession {
  sessionId: string;
  userId: string;
  challengeId: string;
  startTime: string;
  status: 'active' | 'paused' | 'completed';
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

class ProctoringService {
  /**
   * Start a new proctoring session
   */
  async startSession(challengeId: string): Promise<{ sessionId: string }> {
    try {
      const response = await apiClient.post('/proctoring/session/start', { challengeId });
      const data = unwrapData<{ sessionId: string }>(response);
      return { sessionId: data.sessionId };
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
    try {
      const response = await apiClient.post('/proctoring/violation', {
        sessionId,
        type,
        description: description || `Violation: ${type}`
      });
      
      return unwrapData<ProctoringViolation>(response);
    } catch {
      // Return a mock violation if backend fails
      return {
        type,
        severity: 'medium',
        description: description || `Violation: ${type}`,
        penalty: 5,
        timestamp: new Date().toISOString()
      };
    }
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
    try {
      const response = await apiClient.get(`/proctoring/user/${userId}/sessions?limit=${limit}`);
      return unwrapData<ProctoringSession[]>(response);
    } catch {
      return [];
    }
  }

  /**
   * Get violation summary for a user
   */
  async getUserViolationSummary(userId: string): Promise<{
    totalViolations: number;
    totalPenalty: number;
    byType: Record<string, number>;
  }> {
    try {
      const response = await apiClient.get(`/proctoring/user/${userId}/violations/summary`);
      return unwrapData(response);
    } catch {
      return {
        totalViolations: 0,
        totalPenalty: 0,
        byType: {}
      };
    }
  }

  /**
   * Check if proctoring service is available
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      // We'll use a simple endpoint check
      await apiClient.get('/proctoring/health');
      return {
        status: 'healthy',
        message: 'Proctoring service is available'
      };
    } catch {
      return {
        status: 'unhealthy',
        message: 'Proctoring service is temporarily unavailable'
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
    try {
      const response = await apiClient.post('/proctoring/violations/batch', { sessionId, violations });
      return unwrapData<ProctoringViolation[]>(response);
    } catch {
      return violations.map(violation => ({
        type: violation.type,
        severity: 'medium',
        description: violation.description || `Violation: ${violation.type}`,
        penalty: 5,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Get session analytics for dashboard
   */
  async getSessionAnalytics(sessionId: string): Promise<{
    violationTimeline: Array<{ timestamp: string; count: number }>;
    severityDistribution: { high: number; medium: number; low: number };
    peakViolationTime: string | null;
  }> {
    try {
      const response = await apiClient.get(`/proctoring/session/${sessionId}/analytics`);
      return unwrapData(response);
    } catch {
      return {
        violationTimeline: [],
        severityDistribution: { high: 0, medium: 0, low: 0 },
        peakViolationTime: null
      };
    }
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
    try {
      const response = await apiClient.get(`/proctoring/session/${sessionId}/status`);
      return unwrapData(response);
    } catch {
      return {
        isActive: true,
        isPaused: false,
        status: 'active',
        pauseReason: null,
        heartbeatAt: null,
        isHeartbeatStale: false,
        violationsSinceLastCheck: 0,
        currentScore: 100
      };
    }
  }

  /**
   * Get proctoring settings for the current user
   */
  async getSettings(): Promise<{
    requireCamera: boolean;
    requireMicrophone: boolean;
    strictMode: boolean;
    allowedViolationsBeforeWarning: number;
    autoPauseOnViolation: boolean;
  }> {
    try {
      const response = await apiClient.get('/proctoring/settings');
      return unwrapData(response);
    } catch {
      return {
        requireCamera: true,
        requireMicrophone: true,
        strictMode: false,
        allowedViolationsBeforeWarning: 3,
        autoPauseOnViolation: false
      };
    }
  }

  /**
   * Update proctoring settings
   */
  async updateSettings(settings: Partial<{
    requireCamera: boolean;
    requireMicrophone: boolean;
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
}

export const proctoringService = new ProctoringService();
export default proctoringService;
