import { Router } from 'express';
import { ChallengeController } from '../controllers/challenge.controller';
import { ReferenceDocsController } from '../controllers/referenceDocs.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { ChallengeTestsController } from '../controllers/challengeTests.controller';

const router = Router();
const challengeController = new ChallengeController();
const referenceDocsController = new ReferenceDocsController();
const challengeTestsController = new ChallengeTestsController();

router.get('/', challengeController.listChallenges.bind(challengeController));
router.get('/next', authenticate, challengeController.getNextChallenge.bind(challengeController));
router.post(
  '/:challenge_id/coach-hint',
  authenticate,
  challengeController.getCoachHint.bind(challengeController),
);
router.get('/:challenge_id', challengeController.getChallengeDetails.bind(challengeController));

// Reference docs routes
router.get('/:challenge_id/docs', referenceDocsController.getChallengeDocs.bind(referenceDocsController));
router.post('/:challenge_id/docs', authenticate, authorize('admin'), referenceDocsController.createDoc.bind(referenceDocsController));

// Challenge tests & baselines (admin)
router.get('/:challenge_id/tests', authenticate, authorize('admin'), challengeTestsController.list.bind(challengeTestsController));
router.post('/:challenge_id/tests', authenticate, authorize('admin'), challengeTestsController.upsert.bind(challengeTestsController));
router.put('/:challenge_id/tests/:test_id', authenticate, authorize('admin'), challengeTestsController.upsert.bind(challengeTestsController));
router.delete('/:challenge_id/tests/:test_id', authenticate, authorize('admin'), challengeTestsController.remove.bind(challengeTestsController));
router.get('/:challenge_id/baseline', authenticate, authorize('admin'), challengeTestsController.getBaseline.bind(challengeTestsController));
router.put('/:challenge_id/baseline', authenticate, authorize('admin'), challengeTestsController.upsertBaseline.bind(challengeTestsController));

// Admin-only challenge creation
router.post('/', authenticate, authorize('admin'), challengeController.createChallenge.bind(challengeController));

export default router;
