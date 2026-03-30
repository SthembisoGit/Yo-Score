import { Router } from 'express';

import { UserController } from '../controllers/user.controller';
import { validateParams } from '../middleware/validate.middleware';
import { shareScoreTokenParamSchema } from '../validation/schemas';

const router = Router();
const userController = new UserController();

router.get(
  '/share-score/:token',
  validateParams(shareScoreTokenParamSchema),
  userController.getPublicShareScore.bind(userController),
);

export default router;
