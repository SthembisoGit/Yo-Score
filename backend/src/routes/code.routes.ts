import { Router } from 'express';
import { codeController } from '../controllers/code.controller';
import { authenticate } from '../middleware/auth.middleware';
import { codeRunRateLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(authenticate);
router.post('/run', codeRunRateLimiter, codeController.runCode.bind(codeController));

export default router;
