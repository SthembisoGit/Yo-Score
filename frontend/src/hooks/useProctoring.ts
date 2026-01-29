import { useState, useCallback, useEffect } from 'react';
import { proctoringService } from '@/services/proctoring.service';
import { toast } from 'react-hot-toast';

export const useProctoring = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'unhealthy' | 'checking'>('checking');

  // Check service health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = useCallback(async () => {
    setHealthStatus('checking');
    try {
      const health = await proctoringService.healthCheck();
      setHealthStatus(health.status);
      return health.status === 'healthy';
    } catch (error) {
      setHealthStatus('unhealthy');
      return false;
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await proctoringService.getSettings();
      setSettings(settings);
      return settings;
    } catch (error) {
      console.error('Failed to load proctoring settings:', error);
      return null;
    }
  }, []);

  const startSession = useCallback(async (challengeId: string, userId: string): Promise<string> => {
    try {
      // Check health first
      const isHealthy = await checkHealth();
      if (!isHealthy) {
        toast.error('Proctoring service is unavailable. Continuing without proctoring.');
        return 'mock-session-' + Date.now();
      }

      const response = await proctoringService.startSession(challengeId);
      setCurrentSessionId(response.sessionId);
      setIsActive(true);
      setViolations([]);
      
      // Load settings
      await loadSettings();
      
      return response.sessionId;
    } catch (error) {
      console.error('Failed to start proctoring session:', error);
      toast.error('Failed to start proctoring session');
      throw error;
    }
  }, [checkHealth, loadSettings]);

  const endSession = useCallback(async (sessionId: string, submissionId?: string) => {
    try {
      await proctoringService.endSession(sessionId, submissionId);
      setIsActive(false);
      setCurrentSessionId(null);
      
      // Show session summary if there were violations
      if (violations.length > 0) {
        toast(`Session ended with ${violations.length} proctoring alerts`, {
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Failed to end proctoring session:', error);
      // Still reset state even if backend fails
      setIsActive(false);
      setCurrentSessionId(null);
    }
  }, [violations.length]);

  const logViolation = useCallback(async (sessionId: string, type: string, description?: string) => {
    try {
      const violation = await proctoringService.logViolation(sessionId, type, description);
      
      // Update local state
      setViolations(prev => [...prev, violation]);
      
      // Check if we should warn the user based on settings
      if (settings && violations.length >= settings.allowedViolationsBeforeWarning - 1) {
        toast(`Multiple proctoring violations detected. Your trust score may be affected.`, {
          duration: 6000,
          icon: '⚠️'
        });
      }
      
      return violation;
    } catch (error) {
      console.error('Failed to log violation:', error);
      const mockViolation = {
        type,
        severity: 'medium',
        description: description || `Violation: ${type}`,
        penalty: 5,
        timestamp: new Date().toISOString()
      };
      setViolations(prev => [...prev, mockViolation]);
      return mockViolation;
    }
  }, [settings, violations.length]);

  const getSessionDetails = useCallback(async (sessionId: string) => {
    try {
      return await proctoringService.getSessionDetails(sessionId);
    } catch (error) {
      console.error('Failed to get session details:', error);
      throw error;
    }
  }, []);

  const getViolationSummary = useCallback(async (userId: string) => {
    try {
      return await proctoringService.getUserViolationSummary(userId);
    } catch (error) {
      console.error('Failed to get violation summary:', error);
      return null;
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: any) => {
    try {
      await proctoringService.updateSettings(newSettings);
      setSettings(prev => ({ ...prev, ...newSettings }));
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
    // State
    isActive,
    currentSessionId,
    violations,
    settings,
    healthStatus,
    
    // Actions
    startSession,
    endSession,
    logViolation,
    getSessionDetails,
    getViolationSummary,
    updateSettings,
    clearViolations,
    checkHealth,
    loadSettings,
    
    // Utilities
    hasViolations: violations.length > 0,
    violationCount: violations.length,
    totalPenalty: violations.reduce((sum, violation) => sum + (violation.penalty || 0), 0),
    severeViolations: violations.filter(v => v.severity === 'high').length
  };
};