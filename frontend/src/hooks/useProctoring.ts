import { useState, useCallback, useEffect } from 'react';
import { proctoringService, type ProctoringViolation } from '@/services/proctoring.service';
import { toast } from 'react-hot-toast';

interface ProctoringSettings {
  requireCamera: boolean;
  requireMicrophone: boolean;
  requireAudio: boolean;
  strictMode: boolean;
  allowedViolationsBeforeWarning: number;
  autoPauseOnViolation: boolean;
}

export interface ProctoringSessionStartMeta {
  sessionId: string;
  deadlineAt: string;
  durationSeconds: number;
}

export const useProctoring = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [violations, setViolations] = useState<ProctoringViolation[]>([]);
  const [settings, setSettings] = useState<ProctoringSettings | null>(null);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'unhealthy' | 'checking'>('checking');

  const checkHealth = useCallback(async () => {
    setHealthStatus('checking');
    try {
      const health = await proctoringService.healthCheck();
      setHealthStatus(health.status);
      return health.status === 'healthy';
    } catch {
      setHealthStatus('unhealthy');
      return false;
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  const loadSettings = useCallback(async () => {
    try {
      const loaded = await proctoringService.getSettings();
      setSettings(loaded);
      return loaded;
    } catch (error) {
      console.error('Failed to load proctoring settings:', error);
      return null;
    }
  }, []);

  const startSession = useCallback(async (challengeId: string, _userId: string): Promise<ProctoringSessionStartMeta> => {
    try {
      const response = await proctoringService.startSession(challengeId);
      setCurrentSessionId(response.sessionId);
      setIsActive(true);
      setViolations([]);
      await loadSettings();
      return {
        sessionId: response.sessionId,
        deadlineAt: response.deadline_at,
        durationSeconds: response.duration_seconds,
      };
    } catch (error) {
      console.error('Failed to start proctoring session:', error);
      throw new Error('Proctoring service is unavailable. Please try again.');
    }
  }, [loadSettings]);

  const endSession = useCallback(async (sessionId: string, submissionId?: string) => {
    try {
      await proctoringService.endSession(sessionId, submissionId);
      if (violations.length > 0) {
        toast(`Session ended with ${violations.length} proctoring alerts`, {
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Failed to end proctoring session:', error);
    } finally {
      setIsActive(false);
      setCurrentSessionId(null);
    }
  }, [violations.length]);

  const logViolation = useCallback(async (sessionId: string, type: string, description?: string) => {
    try {
      const violation = await proctoringService.logViolation(sessionId, type, description);
      setViolations((previous) => [...previous, violation]);

      if (
        settings &&
        violations.length >= settings.allowedViolationsBeforeWarning - 1
      ) {
        toast('Multiple proctoring violations detected. Your trust score may be affected.', {
          duration: 6000,
          icon: '!'
        });
      }

      return violation;
    } catch (error) {
      console.error('Failed to log violation:', error);
      throw error;
    }
  }, [settings, violations.length]);

  const getSessionDetails = useCallback(async (sessionId: string) => {
    return proctoringService.getSessionDetails(sessionId);
  }, []);

  const getViolationSummary = useCallback(async (userId: string) => {
    try {
      return await proctoringService.getUserViolationSummary(userId);
    } catch (error) {
      console.error('Failed to get violation summary:', error);
      return null;
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<ProctoringSettings>) => {
    try {
      await proctoringService.updateSettings(newSettings);
      setSettings((previous) => ({ ...(previous || {
        requireCamera: true,
        requireMicrophone: true,
        requireAudio: true,
        strictMode: false,
        allowedViolationsBeforeWarning: 3,
        autoPauseOnViolation: false
      }), ...newSettings }));
      toast.success('Proctoring settings updated');
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update settings');
      throw error;
    }
  }, []);

  const clearViolations = useCallback(() => {
    setViolations([]);
  }, []);

  return {
    isActive,
    currentSessionId,
    violations,
    settings,
    healthStatus,
    startSession,
    endSession,
    logViolation,
    getSessionDetails,
    getViolationSummary,
    updateSettings,
    clearViolations,
    checkHealth,
    loadSettings,
    hasViolations: violations.length > 0,
    violationCount: violations.length,
    totalPenalty: violations.reduce((sum, violation) => sum + (violation.penalty || 0), 0),
    severeViolations: violations.filter((violation) => violation.severity === 'high').length
  };
};
