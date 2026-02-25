import { Router } from 'express';
import express from 'express';
import { ProctoringController } from '../controllers/proctoring.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { proctoringIngestRateLimiter } from '../middleware/rateLimit.middleware';
import { validateParams } from '../middleware/validate.middleware';
import { sessionIdParamSchema, userIdParamSchema } from '../validation/schemas';

const router = Router();
const proctoringController = new ProctoringController();

router.use(authenticate);

// Health
router.get('/health', proctoringController.health.bind(proctoringController));
router.get('/privacy', proctoringController.privacyNotice.bind(proctoringController));

// Session lifecycle
router.post('/session/start', proctoringController.startSession.bind(proctoringController));
router.post('/session/end', proctoringController.endSession.bind(proctoringController));
router.post('/session/pause', proctoringController.pauseSession.bind(proctoringController));
router.post('/session/resume', proctoringController.resumeSession.bind(proctoringController));
router.post('/session/heartbeat', proctoringIngestRateLimiter, proctoringController.heartbeat.bind(proctoringController));
router.post('/events/batch', proctoringIngestRateLimiter, proctoringController.ingestEventsBatch.bind(proctoringController));
router.post(
  '/session/:sessionId/snapshot',
  validateParams(sessionIdParamSchema),
  proctoringIngestRateLimiter,
  express.raw({ type: ['image/jpeg', 'image/png', 'application/octet-stream'], limit: '2mb' }),
  proctoringController.uploadSnapshot.bind(proctoringController),
);
router.get(
  '/session/:sessionId',
  validateParams(sessionIdParamSchema),
  proctoringController.getSessionDetails.bind(proctoringController),
);
router.get(
  '/session/:sessionId/analytics',
  validateParams(sessionIdParamSchema),
  proctoringController.getSessionAnalytics.bind(proctoringController),
);
router.get(
  '/session/:sessionId/status',
  validateParams(sessionIdParamSchema),
  proctoringController.getSessionStatus.bind(proctoringController),
);
router.get(
  '/session/:sessionId/risk',
  validateParams(sessionIdParamSchema),
  proctoringController.getSessionRisk.bind(proctoringController),
);
router.post(
  '/session/:sessionId/liveness-check',
  validateParams(sessionIdParamSchema),
  proctoringIngestRateLimiter,
  proctoringController.livenessCheck.bind(proctoringController),
);
router.post(
  '/session/:sessionId/review/enqueue',
  validateParams(sessionIdParamSchema),
  authorize('admin'),
  proctoringController.enqueueReview.bind(proctoringController),
);

// Violations
router.post('/violation', proctoringIngestRateLimiter, proctoringController.logViolation.bind(proctoringController));
router.post(
  '/violations/batch',
  proctoringIngestRateLimiter,
  proctoringController.logMultipleViolations.bind(proctoringController),
);

// User-level views
router.get(
  '/user/:userId/sessions',
  validateParams(userIdParamSchema),
  proctoringController.getUserSessions.bind(proctoringController),
);
router.get(
  '/user/:userId/violations/summary',
  validateParams(userIdParamSchema),
  proctoringController.getUserViolationSummary.bind(proctoringController),
);

// Settings
router.get('/settings', proctoringController.getSettings.bind(proctoringController));
router.put('/settings', authorize('admin'), proctoringController.updateSettings.bind(proctoringController));

// ML Analysis endpoints (require raw body parsing for binary data)
router.post(
  '/analyze-face',
  proctoringIngestRateLimiter,
  express.raw({ type: ['image/jpeg', 'image/png', 'application/octet-stream'], limit: '5mb' }),
  proctoringController.analyzeFace.bind(proctoringController),
);
router.post(
  '/analyze-audio',
  proctoringIngestRateLimiter,
  express.raw({
    type: [
      'audio/webm',
      'audio/wav',
      'audio/ogg',
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'application/octet-stream',
    ],
    limit: '10mb',
  }),
  proctoringController.analyzeAudio.bind(proctoringController),
);

export default router;
