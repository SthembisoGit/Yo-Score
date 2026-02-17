import { Router } from 'express';
import { SubmissionController } from '../controllers/submission.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const submissionController = new SubmissionController();

router.use(authenticate);

router.post('/', submissionController.submitChallenge.bind(submissionController));
router.get('/', submissionController.getUserSubmissions.bind(submissionController));
router.get('/:submission_id/runs', submissionController.getSubmissionRuns.bind(submissionController));
router.get('/:submission_id/runs/:run_id', submissionController.getSubmissionRunDetails.bind(submissionController));
router.get('/:submission_id', submissionController.getSubmissionResult.bind(submissionController));

export default router;
