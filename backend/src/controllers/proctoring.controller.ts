import { Response } from 'express';
import { createHash } from 'crypto';
import { ProctoringService, ProctoringSettings } from '../services/proctoring.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { config } from '../config';

export class ProctoringController {
  private readonly proctoringService = new ProctoringService();
  private readonly maxSnapshotBytes = 2 * 1024 * 1024;
  private readonly maxFaceFrameBytes = 5 * 1024 * 1024;
  private readonly maxAudioChunkBytes = 10 * 1024 * 1024;
  private readonly requireConsent =
    String(config.PROCTORING_REQUIRE_CONSENT).toLowerCase() === 'true';
  private readonly policyVersion = String(config.PROCTORING_PRIVACY_POLICY_VERSION || '2026-02-25');

  private asBuffer(payload: unknown): Buffer {
    if (Buffer.isBuffer(payload)) return payload;
    if (payload === undefined || payload === null) return Buffer.alloc(0);
    if (typeof payload === 'string') return Buffer.from(payload);
    if (payload instanceof Uint8Array) return Buffer.from(payload);
    if (Array.isArray(payload)) return Buffer.from(payload);
    return Buffer.alloc(0);
  }

  private isJpeg(buffer: Buffer): boolean {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  private isPng(buffer: Buffer): boolean {
    if (buffer.length < 8) return false;
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  private isWebm(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  }

  private isWav(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WAVE'
    );
  }

  private isOgg(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS';
  }

  private isMp3(buffer: Buffer): boolean {
    if (buffer.length < 3) return false;
    if (buffer.toString('ascii', 0, 3) === 'ID3') return true;
    if (buffer.length < 2) return false;
    return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  }

  private isMp4(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    return buffer.toString('ascii', 4, 8) === 'ftyp';
  }

  private ensureImagePayload(buffer: Buffer, maxBytes: number) {
    if (!buffer || buffer.length === 0) {
      throw new Error('Image data is required');
    }
    if (buffer.length > maxBytes) {
      throw new Error(`Image payload exceeds ${maxBytes} bytes`);
    }
    if (!this.isJpeg(buffer) && !this.isPng(buffer)) {
      throw new Error('Unsupported image format');
    }
  }

  private ensureAudioPayload(buffer: Buffer, maxBytes: number) {
    if (!buffer || buffer.length === 0) {
      throw new Error('Audio data is required');
    }
    if (buffer.length > maxBytes) {
      throw new Error(`Audio payload exceeds ${maxBytes} bytes`);
    }
    if (!this.isWebm(buffer) && !this.isWav(buffer) && !this.isOgg(buffer) && !this.isMp3(buffer) && !this.isMp4(buffer)) {
      throw new Error('Unsupported audio format');
    }
  }

  private classifyClientInputError(error: unknown): { status: number; message: string } | null {
    if (!(error instanceof Error)) return null;
    const message = error.message || '';
    if (message.includes('Session not found')) {
      return {
        status: 404,
        message: 'Session not found',
      };
    }
    if (message.includes('payload exceeds') || message.includes('exceeds')) {
      return {
        status: 413,
        message,
      };
    }
    if (message.includes('Unsupported image format') || message.includes('Unsupported audio format')) {
      return {
        status: 415,
        message,
      };
    }
    if (message.includes('data is required') || message.includes('is required')) {
      return {
        status: 400,
        message,
      };
    }
    return null;
  }

  private requireUserId(req: AuthenticatedRequest, res: Response): string | null {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
        error: 'UNAUTHORIZED',
      });
      return null;
    }
    return userId;
  }

  private hashIp(ip?: string): string | null {
    if (!ip || ip.trim().length === 0) return null;
    return createHash('sha256')
      .update(`${ip}:${config.JWT_SECRET}`)
      .digest('hex')
      .slice(0, 64);
  }

  async health(_req: AuthenticatedRequest, res: Response) {
    try {
      const health = await this.proctoringService.healthCheck();
      return res.status(200).json({
        success: true,
        message: 'Proctoring service health',
        data: health,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve proctoring health',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async privacyNotice(_req: AuthenticatedRequest, res: Response) {
    try {
      const notice = this.proctoringService.getPrivacyNotice();
      return res.status(200).json({
        success: true,
        message: 'Proctoring privacy notice',
        data: notice,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve proctoring privacy notice',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async startSession(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { challengeId } = req.body;

      if (!challengeId) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID is required',
        });
      }

      const rawConsent = req.body?.consent;
      if (this.requireConsent) {
        if (!rawConsent || typeof rawConsent !== 'object') {
          return res.status(400).json({
            success: false,
            message: 'Proctoring privacy consent is required',
            error: 'CONSENT_REQUIRED',
            data: {
              required_policy_version: this.policyVersion,
            },
          });
        }

        const accepted =
          rawConsent.accepted === true ||
          rawConsent.consentAccepted === true ||
          (typeof rawConsent.accepted_at === 'string' && rawConsent.accepted_at.trim().length > 0) ||
          (typeof rawConsent.acceptedAt === 'string' && rawConsent.acceptedAt.trim().length > 0);
        if (!accepted) {
          return res.status(400).json({
            success: false,
            message: 'You must accept the proctoring privacy notice before starting',
            error: 'CONSENT_REQUIRED',
            data: {
              required_policy_version: this.policyVersion,
            },
          });
        }

        const requestedVersion =
          typeof rawConsent.policy_version === 'string'
            ? rawConsent.policy_version
            : typeof rawConsent.policyVersion === 'string'
              ? rawConsent.policyVersion
              : '';
        if (!requestedVersion || requestedVersion !== this.policyVersion) {
          return res.status(409).json({
            success: false,
            message: 'Proctoring privacy notice has changed. Please review and accept the latest version.',
            error: 'CONSENT_VERSION_MISMATCH',
            data: {
              required_policy_version: this.policyVersion,
            },
          });
        }
      }

      const acceptedAtRaw =
        typeof rawConsent?.accepted_at === 'string'
          ? rawConsent.accepted_at
          : typeof rawConsent?.acceptedAt === 'string'
            ? rawConsent.acceptedAt
            : new Date().toISOString();
      const acceptedAtDate = new Date(acceptedAtRaw);
      const acceptedAt = Number.isNaN(acceptedAtDate.getTime())
        ? new Date().toISOString()
        : acceptedAtDate.toISOString();

      const consentScope = Array.isArray(rawConsent?.scope)
        ? rawConsent.scope.filter((scope: unknown) => typeof scope === 'string')
        : Array.isArray(rawConsent?.consentScope)
          ? rawConsent.consentScope.filter((scope: unknown) => typeof scope === 'string')
          : [
              'camera_presence_signals',
              'microphone_device_state',
              'proctoring_events',
              'limited_snapshots_on_triggers',
            ];

      const session = await this.proctoringService.startSession(userId, challengeId, {
        policyVersion: this.policyVersion,
        acceptedAt,
        noticeLocale:
          typeof rawConsent?.locale === 'string'
            ? rawConsent.locale
            : typeof rawConsent?.notice_locale === 'string'
              ? rawConsent.notice_locale
              : null,
        userAgent: String(req.headers['user-agent'] ?? '').slice(0, 512) || null,
        ipHash: this.hashIp(req.ip),
        consentScope,
      });

      return res.status(201).json({
        success: true,
        message: 'Proctoring session started',
        data: {
          sessionId: session.sessionId,
          deadline_at: session.deadlineAt,
          duration_seconds: session.durationSeconds,
          privacy_notice: {
            policy_version: this.policyVersion,
            retention_days: this.proctoringService.getPrivacyNotice().retention_days,
          },
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('consent')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: 'CONSENT_REQUIRED',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to start proctoring session',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async endSession(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { sessionId, submissionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      await this.proctoringService.endSession(sessionId, userId, submissionId);

      return res.status(200).json({
        success: true,
        message: 'Proctoring session ended',
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to end proctoring session',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async pauseSession(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { sessionId, reason } = req.body as { sessionId?: string; reason?: string };

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const paused = await this.proctoringService.pauseSession(
        sessionId,
        userId,
        reason || 'Session paused by proctoring policy',
      );

      return res.status(200).json({
        success: true,
        message: 'Proctoring session paused',
        data: paused,
      });
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Failed to pause proctoring session',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async resumeSession(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { sessionId } = req.body as { sessionId?: string };

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const resumed = await this.proctoringService.resumeSession(sessionId, userId);

      return res.status(200).json({
        success: true,
        message: 'Proctoring session resumed',
        data: resumed,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message === 'Liveness check required before resume'
          ? 'Liveness verification is required before resuming the session'
          : 'Failed to resume proctoring session';
      const code =
        error instanceof Error && error.message === 'Liveness check required before resume'
          ? 409
          : 400;
      return res.status(code).json({
        success: false,
        message,
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async heartbeat(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

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

      const heartbeat = await this.proctoringService.recordHeartbeat(sessionId, userId, {
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
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Failed to record heartbeat',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async logViolation(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { sessionId, type, description, evidence } = req.body;

      if (!sessionId || !type) {
        return res.status(400).json({
          success: false,
          message: 'Session ID and violation type are required',
        });
      }

      const violation = await this.proctoringService.logViolation(
        sessionId,
        userId,
        type,
        description,
        evidence,
      );

      return res.status(201).json({
        success: true,
        message: 'Violation logged',
        data: violation,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to log violation',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async logMultipleViolations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

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
        userId,
        violations,
      );

      return res.status(201).json({
        success: true,
        message: 'Violations logged',
        data: logged,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to log violations',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async ingestEventsBatch(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { session_id, events } = req.body as {
        session_id?: string;
        sequence_start?: number;
        events?: Array<{
          event_type: string;
          severity: 'low' | 'medium' | 'high';
          payload?: Record<string, unknown>;
          timestamp?: string;
          sequence_id?: number;
          client_ts?: string;
          confidence?: number;
          duration_ms?: number;
          model_version?: string;
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
        userId,
        events,
        Number(req.body?.sequence_start),
      );

      return res.status(200).json({
        success: true,
        message: 'Proctoring events ingested',
        data: result,
      });
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Failed to ingest proctoring events',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async uploadSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

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

      const imageBuffer = this.asBuffer(req.body);
      this.ensureImagePayload(imageBuffer, this.maxSnapshotBytes);

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
        userId,
        triggerType,
        imageBuffer,
        metadata,
      );

      return res.status(201).json({
        success: true,
        message: 'Snapshot stored',
        data: saved,
      });
    } catch (error: unknown) {
      const classified = this.classifyClientInputError(error);
      if (classified) {
        return res.status(classified.status).json({
          success: false,
          message: classified.message,
          error: 'PROCTORING_REQUEST_FAILED',
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Failed to store snapshot',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async getSessionDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const requesterId = this.requireUserId(req, res);
      if (!requesterId) return;

      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const sessionDetails = await this.proctoringService.getSessionDetails(
        sessionId,
        requesterId,
        req.user?.role === 'admin',
      );

      return res.status(200).json({
        success: true,
        message: 'Session details retrieved',
        data: sessionDetails,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to get session details',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async getSessionAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const requesterId = this.requireUserId(req, res);
      if (!requesterId) return;

      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const analytics = await this.proctoringService.getSessionAnalytics(
        sessionId,
        requesterId,
        req.user?.role === 'admin',
      );

      return res.status(200).json({
        success: true,
        message: 'Session analytics retrieved',
        data: analytics,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
          error: 'PROCTORING_REQUEST_FAILED',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to get session analytics',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async getSessionStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const requesterId = this.requireUserId(req, res);
      if (!requesterId) return;

      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const status = await this.proctoringService.getSessionStatus(
        sessionId,
        requesterId,
        req.user?.role === 'admin',
      );

      return res.status(200).json({
        success: true,
        message: 'Session status retrieved',
        data: status,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
          error: 'PROCTORING_REQUEST_FAILED',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to get session status',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async getSessionRisk(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const risk = await this.proctoringService.getSessionRisk(sessionId, userId);
      return res.status(200).json({
        success: true,
        message: 'Session risk retrieved',
        data: risk,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
          error: 'PROCTORING_REQUEST_FAILED',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve session risk',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async livenessCheck(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const { sessionId } = req.params;
      const responseAction = typeof req.body?.response_action === 'string'
        ? req.body.response_action
        : '';

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      if (!responseAction) {
        const challenge = await this.proctoringService.requestLivenessChallenge(sessionId, userId);
        return res.status(200).json({
          success: true,
          message: 'Liveness challenge issued',
          data: challenge,
        });
      }

      const verification = await this.proctoringService.verifyLivenessChallenge(
        sessionId,
        userId,
        responseAction,
      );
      return res.status(200).json({
        success: true,
        message: verification.message,
        data: verification,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('Session not found')) {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
          error: 'PROCTORING_REQUEST_FAILED',
        });
      }

      return res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Liveness check failed',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async enqueueReview(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required',
        });
      }

      const queued = await this.proctoringService.enqueueSessionReview(sessionId);
      return res.status(202).json({
        success: true,
        message: 'Post-session review enqueued',
        data: queued,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to enqueue post-session review',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async getUserSessions(req: AuthenticatedRequest, res: Response) {
    try {
      const requesterId = this.requireUserId(req, res);
      if (!requesterId) return;

      const { userId } = req.params;
      const limit = Number(req.query.limit ?? 10);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      if (userId !== requesterId && req.user?.role !== 'admin') {
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
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to get user sessions',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async getUserViolationSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const requesterId = this.requireUserId(req, res);
      if (!requesterId) return;

      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required',
        });
      }

      if (userId !== requesterId && req.user?.role !== 'admin') {
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
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to get user violation summary',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async getSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const settings = await this.proctoringService.getSettingsForUser(userId);

      return res.status(200).json({
        success: true,
        message: 'Proctoring settings retrieved',
        data: settings,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to get proctoring settings',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = this.requireUserId(req, res);
      if (!userId) return;

      const partialSettings = req.body as Partial<ProctoringSettings>;
      const updated = await this.proctoringService.updateSettingsForUser(
        userId,
        partialSettings,
      );

      return res.status(200).json({
        success: true,
        message: 'Proctoring settings updated',
        data: updated,
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: 'Failed to update proctoring settings',
        error: 'PROCTORING_REQUEST_FAILED',
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
      const imageBuffer = this.asBuffer(req.body);
      this.ensureImagePayload(imageBuffer, this.maxFaceFrameBytes);

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
    } catch (error: unknown) {
      const classified = this.classifyClientInputError(error);
      if (classified) {
        return res.status(classified.status).json({
          success: false,
          message: classified.message,
          error: 'PROCTORING_REQUEST_FAILED',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze face',
        error: 'PROCTORING_REQUEST_FAILED',
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
      const audioBuffer = this.asBuffer(req.body);
      this.ensureAudioPayload(audioBuffer, this.maxAudioChunkBytes);

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
    } catch (error: unknown) {
      const classified = this.classifyClientInputError(error);
      if (classified) {
        return res.status(classified.status).json({
          success: false,
          message: classified.message,
          error: 'PROCTORING_REQUEST_FAILED',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze audio',
        error: 'PROCTORING_REQUEST_FAILED',
      });
    }
  }
}
