import { Router } from 'express';
import { ChallengeController } from '../controllers/challenge.controller';
import { ReferenceDocsController } from '../controllers/referenceDocs.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
const challengeController = new ChallengeController();
const referenceDocsController = new ReferenceDocsController();

// Public routes
router.get('/', challengeController.listChallenges.bind(challengeController));
router.get('/:challenge_id', challengeController.getChallengeDetails.bind(challengeController));

// Reference docs routes
router.get('/:challenge_id/docs', referenceDocsController.getChallengeDocs.bind(referenceDocsController));
router.post('/:challenge_id/docs', authenticate, authorize('admin'), referenceDocsController.createDoc.bind(referenceDocsController));

// Admin-only challenge creation
router.post('/', authenticate, authorize('admin'), challengeController.createChallenge.bind(challengeController));

export default router;