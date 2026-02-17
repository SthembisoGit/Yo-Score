import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { AdminController } from '../controllers/admin.controller';
import { adminPanelEnabled } from '../config';

const router = Router();
const controller = new AdminController();

router.use(authenticate);

router.use((req, res, next) => {
  if (!adminPanelEnabled) {
    return res.status(503).json({
      success: false,
      message: 'Admin panel is disabled by configuration',
      error: 'ADMIN_PANEL_DISABLED',
    });
  }
  return next();
});

router.use(authorize('admin'));

router.get('/dashboard', controller.getDashboard.bind(controller));

router.get('/challenges', controller.listChallenges.bind(controller));
router.post('/challenges', controller.createChallenge.bind(controller));
router.put('/challenges/:challenge_id', controller.updateChallenge.bind(controller));
router.put('/challenges/:challenge_id/publish', controller.setChallengeStatus.bind(controller));
router.get('/challenges/:challenge_id/readiness', controller.getChallengeReadiness.bind(controller));

router.get('/challenges/:challenge_id/tests', controller.listChallengeTests.bind(controller));
router.post('/challenges/:challenge_id/tests', controller.upsertChallengeTest.bind(controller));
router.put('/challenges/:challenge_id/tests/:test_id', controller.upsertChallengeTest.bind(controller));
router.delete('/challenges/:challenge_id/tests/:test_id', controller.deleteChallengeTest.bind(controller));

router.get('/challenges/:challenge_id/baseline', controller.getChallengeBaseline.bind(controller));
router.put('/challenges/:challenge_id/baseline', controller.upsertChallengeBaseline.bind(controller));

router.get('/challenges/:challenge_id/docs', controller.listChallengeDocs.bind(controller));
router.post('/challenges/:challenge_id/docs', controller.createChallengeDoc.bind(controller));

router.get('/judge/health', controller.getJudgeHealth.bind(controller));
router.get('/judge/runs', controller.listJudgeRuns.bind(controller));
router.get('/judge/runs/:run_id', controller.getJudgeRun.bind(controller));
router.post('/judge/runs/:run_id/retry', controller.retryJudgeRun.bind(controller));

router.get('/proctoring/sessions', controller.listProctoringSessions.bind(controller));
router.get('/proctoring/summary', controller.getProctoringSummary.bind(controller));
router.get('/proctoring/sessions/:session_id', controller.getProctoringSession.bind(controller));
router.get('/proctoring/settings', controller.getProctoringSettings.bind(controller));
router.put('/proctoring/settings', controller.updateProctoringSettings.bind(controller));

router.get('/users', controller.listUsers.bind(controller));
router.put('/users/:user_id/role', controller.updateUserRole.bind(controller));
router.get('/audit-logs', controller.getAuditLogs.bind(controller));
router.get('/work-experience/flagged', controller.listFlaggedWorkExperience.bind(controller));

export default router;
