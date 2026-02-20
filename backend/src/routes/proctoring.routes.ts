import { Router } from 'express';
import express from 'express';
import { ProctoringController } from '../controllers/proctoring.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const proctoringController = new ProctoringController();

router.use(authenticate);

// Health
router.get('/health', proctoringController.health.bind(proctoringController));

// Session lifecycle
router.post('/session/start', proctoringController.startSession.bind(proctoringController));
router.post('/session/end', proctoringController.endSession.bind(proctoringController));
router.post('/session/pause', proctoringController.pauseSession.bind(proctoringController));
router.post('/session/resume', proctoringController.resumeSession.bind(proctoringController));
router.post('/session/heartbeat', proctoringController.heartbeat.bind(proctoringController));
router.post('/events/batch', proctoringController.ingestEventsBatch.bind(proctoringController));
router.post(
  '/session/:sessionId/snapshot',
  express.raw({ type: ['image/jpeg', 'image/png', 'application/octet-stream'], limit: '2mb' }),
  proctoringController.uploadSnapshot.bind(proctoringController),
);
router.get(
  '/session/:sessionId',
  proctoringController.getSessionDetails.bind(proctoringController),
);
router.get(
  '/session/:sessionId/analytics',
  proctoringController.getSessionAnalytics.bind(proctoringController),
);
router.get(
  '/session/:sessionId/status',
  proctoringController.getSessionStatus.bind(proctoringController),
);

// Violations
router.post('/violation', proctoringController.logViolation.bind(proctoringController));
router.post(
  '/violations/batch',
  proctoringController.logMultipleViolations.bind(proctoringController),
);

// User-level views
router.get(
  '/user/:userId/sessions',
  proctoringController.getUserSessions.bind(proctoringController),
);
router.get(
  '/user/:userId/violations/summary',
  proctoringController.getUserViolationSummary.bind(proctoringController),
);

// Settings
router.get('/settings', proctoringController.getSettings.bind(proctoringController));
router.put('/settings', authorize('admin'), proctoringController.updateSettings.bind(proctoringController));

// ML Analysis endpoints (require raw body parsing for binary data)
router.post(
  '/analyze-face',
  express.raw({ type: ['image/jpeg', 'image/png', 'application/octet-stream'], limit: '5mb' }),
  proctoringController.analyzeFace.bind(proctoringController),
);
router.post(
  '/analyze-audio',
  express.raw({ type: ['audio/webm', 'audio/wav', 'application/octet-stream'], limit: '10mb' }),
  proctoringController.analyzeAudio.bind(proctoringController),
);

export default router;
