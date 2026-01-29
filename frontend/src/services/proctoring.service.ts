import apiClient from "./apiClient";


export interface ProctoringSession {
  sessionId: string;
  userId: string;
  challengeId: string;
  startTime: string;
  status: 'active' | 'completed';
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

class ProctoringService {
  /**
   * Start a new proctoring session
   */
  async startSession(challengeId: string): Promise<{ sessionId: string }> {
    try {
      const response = await apiClient.post('/proctoring/session/start', {
        challengeId
      });
      
      return {
        sessionId: response.data.data.sessionId
      };
    } catch (error) {
      console.error('Failed to start proctoring session:', error);
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
    } catch (error) {
      console.error('Failed to end proctoring session:', error);
      // Don't throw - we don't want to block submission if proctoring fails
    }
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
      
      return response.data.data;
    } catch (error) {
      console.error('Failed to log violation:', error);
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
      return response.data.data;
    } catch (error) {
      console.error('Failed to get session details:', error);
      throw new Error('Could not retrieve session details');
    }
  }

  /**
   * Get user's recent proctoring sessions
   */
  async getUserSessions(userId: string, limit: number = 10): Promise<ProctoringSession[]> {
    try {
      const response = await apiClient.get(`/proctoring/user/${userId}/sessions?limit=${limit}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get user sessions:', error);
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
      return response.data.data;
    } catch (error) {
      console.error('Failed to get violation summary:', error);
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
    } catch (error) {
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
      const response = await apiClient.post('/proctoring/violations/batch', {
        sessionId,
        violations
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to log multiple violations:', error);
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
      return response.data.data;
    } catch (error) {
      console.error('Failed to get session analytics:', error);
      return {
        violationTimeline: [],
        severityDistribution: { high: 0, medium: 0, low: 0 },
        peakViolationTime: null
      };
    }
  }

  /**
   * Upload frame for ML analysis (for future use)
   */
  async analyzeFrame(sessionId: string, frame: Blob): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('frame', frame, 'frame.jpg');
      formData.append('sessionId', sessionId);
      formData.append('timestamp', new Date().toISOString());

      const response = await apiClient.post('/proctoring/analyze-face', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to analyze frame:', error);
      return null;
    }
  }

  /**
   * Upload audio for ML analysis (for future use)
   */
  async analyzeAudio(sessionId: string, audio: Blob, durationMs: number): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('audio', audio, 'audio.webm');
      formData.append('sessionId', sessionId);
      formData.append('durationMs', durationMs.toString());
      formData.append('timestamp', new Date().toISOString());

      const response = await apiClient.post('/proctoring/analyze-audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Failed to analyze audio:', error);
      return null;
    }
  }

  /**
   * Get real-time session status
   */
  async getSessionStatus(sessionId: string): Promise<{
    isActive: boolean;
    violationsSinceLastCheck: number;
    currentScore: number;
  }> {
    try {
      const response = await apiClient.get(`/proctoring/session/${sessionId}/status`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get session status:', error);
      return {
        isActive: true,
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
      return response.data.data;
    } catch (error) {
      console.error('Failed to get proctoring settings:', error);
      // Default settings
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
    } catch (error) {
      console.error('Failed to update proctoring settings:', error);
      throw new Error('Could not update settings');
    }
  }
}

// Export a singleton instance
export const proctoringService = new ProctoringService();
export default proctoringService;