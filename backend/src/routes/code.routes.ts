import { Router } from 'express';
import { codeController } from '../controllers/code.controller';
import { authenticate } from '../middleware/auth.middleware';
import { codeRunRateLimiter } from '../middleware/rateLimit.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { codeRunSchema } from '../validation/schemas';

const router = Router();

router.use(authenticate);
router.post('/run', codeRunRateLimiter, validateBody(codeRunSchema), codeController.runCode.bind(codeController));

export default router;
