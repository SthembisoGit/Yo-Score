import { Response } from 'express';
import { ProctoringService, ProctoringSettings } from '../services/proctoring.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class ProctoringController {
  private readonly proctoringService = new ProctoringService();

  async health(_req: AuthenticatedRequest, res: Response) {
    try {
      const health = await this.proctoringService.healthCheck();
      return res.status(200).json({
        success: true,
        message: 'Proctoring service health',
        data: health,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve proctoring health',
        error: error.message,
      });
    }
  }

  async startSession(req: AuthenticatedRequest, res: Response) {
    try {
      const { challengeId } = req.body;

      if (!challengeId) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID is required',
        });
      }

      const session = await this.proctoringService.startSession(req.user.id, challengeId);

      return res.status(201).json({
        success: true,
        message: 'Proctoring session started',
        data: {
          sessionId: session.sessionId,
          deadline_at: session.deadlineAt,
          duration_seconds: session.durationSeconds,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to start proctoring session',
        error: error.message,
      });
    }
  }

  async endSession(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId, submissionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      await this.proctoringService.endSession(sessionId, submissionId);

      return res.status(200).json({
        success: true,
        message: 'Proctoring session ended',
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to end proctoring session',
        error: error.message,
      });
    }
  }

  async pauseSession(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId, reason } = req.body as { sessionId?: string; reason?: string };

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const paused = await this.proctoringService.pauseSession(
        sessionId,
        req.user.id,
        reason || 'Session paused by proctoring policy',
      );

      return res.status(200).json({
        success: true,
        message: 'Proctoring session paused',
        data: paused,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Failed to pause proctoring session',
        error: error.message,
      });
    }
  }

  async resumeSession(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.body as { sessionId?: string };

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const resumed = await this.proctoringService.resumeSession(sessionId, req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Proctoring session resumed',
        data: resumed,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Failed to resume proctoring session',
        error: error.message,
      });
    }
  }

  async heartbeat(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId, cameraReady, microphoneReady, audioReady, isPaused, windowFocused, timestamp } = req.body as {
        sessionId?: string;
        cameraReady?: boolean;
        microphoneReady?: boolean;
        audioReady?: boolean;
        isPaused?: boolean;
        windowFocused?: boolean;
        timestamp?: string;
      };

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      if (
        typeof cameraReady !== 'boolean' ||
        typeof microphoneReady !== 'boolean' ||
        typeof audioReady !== 'boolean'
      ) {
        return res.status(400).json({
          success: false,
          message: 'cameraReady, microphoneReady, and audioReady are required',
        });
      }

      const heartbeat = await this.proctoringService.recordHeartbeat(sessionId, req.user.id, {
        cameraReady,
        microphoneReady,
        audioReady,
        isPaused,
        windowFocused,
        timestamp,
      });

      return res.status(200).json({
        success: true,
        message: 'Heartbeat recorded',
        data: heartbeat,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Failed to record heartbeat',
        error: error.message,
      });
    }
  }

  async logViolation(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId, type, description, evidence } = req.body;

      if (!sessionId || !type) {
        return res.status(400).json({
          success: false,
          message: 'Session ID and violation type are required',
        });
      }

      const violation = await this.proctoringService.logViolation(
        sessionId,
        req.user.id,
        type,
        description,
        evidence,
      );

      return res.status(201).json({
        success: true,
        message: 'Violation logged',
        data: violation,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log violation',
        error: error.message,
      });
    }
  }

  async logMultipleViolations(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId, violations } = req.body as {
        sessionId?: string;
        violations?: Array<{ type: string; description?: string }>;
      };

      if (!sessionId || !Array.isArray(violations) || violations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Session ID and at least one violation are required',
        });
      }

      const logged = await this.proctoringService.logMultipleViolations(
        sessionId,
        req.user.id,
        violations,
      );

      return res.status(201).json({
        success: true,
        message: 'Violations logged',
        data: logged,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log violations',
        error: error.message,
      });
    }
  }

  async ingestEventsBatch(req: AuthenticatedRequest, res: Response) {
    try {
      const { session_id, events } = req.body as {
        session_id?: string;
        events?: Array<{
          event_type: string;
          severity: 'low' | 'medium' | 'high';
          payload?: Record<string, unknown>;
          timestamp?: string;
        }>;
      };

      if (!session_id || !Array.isArray(events)) {
        return res.status(400).json({
          success: false,
          message: 'session_id and events[] are required',
        });
      }

      const result = await this.proctoringService.ingestEventBatch(
        session_id,
        req.user.id,
        events,
      );

      return res.status(200).json({
        success: true,
        message: 'Proctoring events ingested',
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Failed to ingest proctoring events',
        error: error.message,
      });
    }
  }

  async uploadSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const triggerType =
        (req.query.trigger_type as string) ||
        (req.query.triggerType as string) ||
        'sampled_snapshot';

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const imageBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body as any);
      if (!imageBuffer || imageBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Snapshot image data is required',
        });
      }

      let metadata: Record<string, unknown> = {};
      const metadataHeader = req.headers['x-proctoring-metadata'];
      if (typeof metadataHeader === 'string' && metadataHeader.trim().length > 0) {
        try {
          metadata = JSON.parse(decodeURIComponent(metadataHeader));
        } catch {
          metadata = {};
        }
      }

      const saved = await this.proctoringService.storeSnapshot(
        sessionId,
        req.user.id,
        triggerType,
        imageBuffer,
        metadata,
      );

      return res.status(201).json({
        success: true,
        message: 'Snapshot stored',
        data: saved,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Failed to store snapshot',
        error: error.message,
      });
    }
  }

  async getSessionDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const sessionDetails = await this.proctoringService.getSessionDetails(sessionId);

      return res.status(200).json({
        success: true,
        message: 'Session details retrieved',
        data: sessionDetails,
      });
    } catch (error: any) {
      if (error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to get session details',
        error: error.message,
      });
    }
  }

  async getSessionAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const analytics = await this.proctoringService.getSessionAnalytics(sessionId);

      return res.status(200).json({
        success: true,
        message: 'Session analytics retrieved',
        data: analytics,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get session analytics',
        error: error.message,
      });
    }
  }

  async getSessionStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const status = await this.proctoringService.getSessionStatus(sessionId);

      return res.status(200).json({
        success: true,
        message: 'Session status retrieved',
        data: status,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get session status',
        error: error.message,
      });
    }
  }

  async getUserSessions(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      const limit = Number(req.query.limit ?? 10);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      if (userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own proctoring sessions',
        });
      }

      const sessions = await this.proctoringService.getUserSessions(userId, limit);

      return res.status(200).json({
        success: true,
        message: 'User sessions retrieved',
        data: sessions,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get user sessions',
        error: error.message,
      });
    }
  }

  async getUserViolationSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      if (userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own violation summary',
        });
      }

      const summary = await this.proctoringService.getUserViolationSummary(userId);

      return res.status(200).json({
        success: true,
        message: 'User violation summary retrieved',
        data: summary,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get user violation summary',
        error: error.message,
      });
    }
  }

  async getSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const settings = await this.proctoringService.getSettingsForUser(req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Proctoring settings retrieved',
        data: settings,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get proctoring settings',
        error: error.message,
      });
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const partialSettings = req.body as Partial<ProctoringSettings>;
      const updated = await this.proctoringService.updateSettingsForUser(
        req.user.id,
        partialSettings,
      );

      return res.status(200).json({
        success: true,
        message: 'Proctoring settings updated',
        data: updated,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update proctoring settings',
        error: error.message,
      });
    }
  }

  async analyzeFace(req: AuthenticatedRequest, res: Response) {
    try {
      const sessionId = (req.query.sessionId as string) || (req.body?.sessionId as string);
      const timestamp = (req.query.timestamp as string) || req.body?.timestamp || new Date().toISOString();

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      // Get image buffer from request body (raw binary data)
      const imageBuffer = Buffer.isBuffer(req.body) 
        ? req.body 
        : Buffer.from(req.body as any);

      if (!imageBuffer || imageBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Image data is required',
        });
      }

      const result = await this.proctoringService.analyzeFaceFrame(
        sessionId,
        imageBuffer,
        timestamp,
      );

      return res.status(200).json({
        success: true,
        message: 'Face analysis completed',
        data: result,
      });
    } catch (error: any) {
      console.error('Face analysis error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze face',
        error: error.message,
      });
    }
  }

  async analyzeAudio(req: AuthenticatedRequest, res: Response) {
    try {
      const sessionId = (req.query.sessionId as string) || (req.body?.sessionId as string);
      const timestamp = (req.query.timestamp as string) || req.body?.timestamp || new Date().toISOString();
      const durationMs = Number(req.query.durationMs || req.body?.durationMs || 10000);

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      // Get audio buffer from request body (raw binary data)
      const audioBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body as any);

      if (!audioBuffer || audioBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Audio data is required',
        });
      }

      const result = await this.proctoringService.analyzeAudioChunk(
        sessionId,
        audioBuffer,
        timestamp,
        durationMs,
      );

      return res.status(200).json({
        success: true,
        message: 'Audio analysis completed',
        data: result,
      });
    } catch (error: any) {
      console.error('Audio analysis error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze audio',
        error: error.message,
      });
    }
  }
}
