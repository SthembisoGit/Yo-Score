import { Router } from 'express';
import { ProctoringController } from '../controllers/proctoring.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const proctoringController = new ProctoringController();

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'proctoring',
    timestamp: new Date().toISOString()
  });
});

router.use(authenticate);

router.post('/session/start', proctoringController.startSession.bind(proctoringController));
router.post('/session/end', proctoringController.endSession.bind(proctoringController));
router.post('/violation', proctoringController.logViolation.bind(proctoringController));
router.get('/session/:sessionId', proctoringController.getSessionDetails.bind(proctoringController));

export default router;