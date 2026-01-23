import { Router } from 'express';
import { ChallengeController } from '../controllers/challenge.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const challengeController = new ChallengeController();

// Public routes
router.get('/', challengeController.listChallenges.bind(challengeController));
router.get('/:challenge_id', challengeController.getChallengeDetails.bind(challengeController));

// Admin-only routes
router.post('/', authenticate, authorize('ADMIN'), challengeController.createChallenge.bind(challengeController));

export default router;