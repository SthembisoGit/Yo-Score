import { Response } from 'express';
import { adminService } from '../services/admin.service';
import { challengeService } from '../services/challenge.service';
import { challengeTestsService } from '../services/challengeTests.service';
import { ReferenceDocsService } from '../services/referenceDocs.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { safeErrorMessage } from '../utils/safeErrorMessage';

const referenceDocsService = new ReferenceDocsService();

export class AdminController {
  async getDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await adminService.getDashboardSummary();
      return res.status(200).json({ success: true, message: 'Admin dashboard retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({ success: false, message, error: 'ADMIN_DASHBOARD_FAILED' });
    }
  }

  async listChallenges(_req: AuthenticatedRequest, res: Response) {
    try {
      const data = await adminService.listChallenges();
      return res.status(200).json({ success: true, message: 'Admin challenges retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({ success: false, message, error: 'ADMIN_CHALLENGES_FAILED' });
    }
  }

  async createChallenge(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        title,
        description,
        category,
        difficulty,
        target_seniority,
        duration_minutes,
        publish_status,
        supported_languages,
      } = req.body;
      if (!title || !description || !category || !difficulty) {
        return res.status(400).json({
          success: false,
          message: 'title, description, category, and difficulty are required',
        });
      }
      const data = await challengeService.createChallenge({
        title,
        description,
        category,
        difficulty,
        target_seniority,
        duration_minutes,
        publish_status,
        supported_languages,
      });
      return res.status(201).json({ success: true, message: 'Challenge created', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_CREATE_FAILED' });
    }
  }

  async updateChallenge(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id } = req.params;
      const data = await adminService.updateChallenge(challenge_id, req.body);
      return res.status(200).json({ success: true, message: 'Challenge updated', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      const code = message.includes('not found') ? 404 : 400;
      return res.status(code).json({ success: false, message, error: 'ADMIN_CHALLENGE_UPDATE_FAILED' });
    }
  }

  async setChallengeStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id } = req.params;
      const { publish_status } = req.body as { publish_status?: 'draft' | 'published' | 'archived' };
      if (!publish_status) {
        return res.status(400).json({ success: false, message: 'publish_status is required' });
      }
      const data = await adminService.publishChallenge(challenge_id, publish_status);
      return res.status(200).json({ success: true, message: 'Challenge publish status updated', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_PUBLISH_FAILED' });
    }
  }

  async getChallengeReadiness(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id } = req.params;
      const data = await adminService.getChallengeReadiness(challenge_id);
      return res.status(200).json({ success: true, message: 'Challenge readiness retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_READINESS_FAILED' });
    }
  }

  async listChallengeTests(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id } = req.params;
      const data = await challengeTestsService.listTestCases(challenge_id);
      return res.status(200).json({ success: true, message: 'Challenge tests retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_TESTS_FAILED' });
    }
  }

  async upsertChallengeTest(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id, test_id } = req.params;
      const data = await challengeTestsService.upsertTestCase(challenge_id, test_id ?? null, req.body);
      return res.status(test_id ? 200 : 201).json({
        success: true,
        message: test_id ? 'Challenge test updated' : 'Challenge test created',
        data,
      });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_TEST_UPSERT_FAILED' });
    }
  }

  async deleteChallengeTest(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id, test_id } = req.params;
      await challengeTestsService.deleteTestCase(challenge_id, test_id);
      return res.status(200).json({
        success: true,
        message: 'Challenge test deleted',
        data: { test_id },
      });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_TEST_DELETE_FAILED' });
    }
  }

  async getChallengeBaseline(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id } = req.params;
      const language = String(req.query.language ?? 'javascript');
      const data = await challengeTestsService.getBaseline(challenge_id, language);
      return res.status(200).json({ success: true, message: 'Challenge baseline retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_BASELINE_FAILED' });
    }
  }

  async upsertChallengeBaseline(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id } = req.params;
      const data = await challengeTestsService.upsertBaseline(challenge_id, req.body);
      return res.status(200).json({ success: true, message: 'Challenge baseline updated', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_BASELINE_UPSERT_FAILED' });
    }
  }

  async listChallengeDocs(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id } = req.params;
      const data = await referenceDocsService.getDocsForChallenge(challenge_id);
      return res.status(200).json({ success: true, message: 'Challenge docs retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_DOCS_FAILED' });
    }
  }

  async createChallengeDoc(req: AuthenticatedRequest, res: Response) {
    try {
      const { challenge_id } = req.params;
      const { title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ success: false, message: 'title and content are required' });
      }
      const data = await referenceDocsService.createDoc(challenge_id, title, content);
      return res.status(201).json({ success: true, message: 'Challenge doc created', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_CHALLENGE_DOC_CREATE_FAILED' });
    }
  }

  async listJudgeRuns(req: AuthenticatedRequest, res: Response) {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
      const status = req.query.status ? String(req.query.status) : undefined;
      const data = await adminService.listJudgeRuns(limit, status);
      return res.status(200).json({ success: true, message: 'Judge runs retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({ success: false, message, error: 'ADMIN_JUDGE_RUNS_FAILED' });
    }
  }

  async getJudgeRun(req: AuthenticatedRequest, res: Response) {
    try {
      const { run_id } = req.params;
      const data = await adminService.getJudgeRunDetails(run_id);
      return res.status(200).json({ success: true, message: 'Judge run details retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      const code = message.includes('not found') ? 404 : 500;
      return res.status(code).json({ success: false, message, error: 'ADMIN_JUDGE_RUN_FAILED' });
    }
  }

  async retryJudgeRun(req: AuthenticatedRequest, res: Response) {
    try {
      const { run_id } = req.params;
      const data = await adminService.retryJudgeRun(run_id);
      return res.status(202).json({ success: true, message: 'Judge retry queued', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_JUDGE_RETRY_FAILED' });
    }
  }

  async getJudgeHealth(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await adminService.getJudgeHealth();
      return res.status(200).json({ success: true, message: 'Judge health retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({ success: false, message, error: 'ADMIN_JUDGE_HEALTH_FAILED' });
    }
  }

  async listProctoringSessions(req: AuthenticatedRequest, res: Response) {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
      const userId = req.query.user_id ? String(req.query.user_id) : undefined;
      const challengeId = req.query.challenge_id ? String(req.query.challenge_id) : undefined;
      const data = await adminService.listRecentProctoringSessions(limit, userId, challengeId);
      return res.status(200).json({ success: true, message: 'Proctoring sessions retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({ success: false, message, error: 'ADMIN_PROCTORING_SESSIONS_FAILED' });
    }
  }

  async getProctoringSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const startDate = req.query.start_date ? String(req.query.start_date) : undefined;
      const endDate = req.query.end_date ? String(req.query.end_date) : undefined;
      const data = await adminService.getProctoringSummary(startDate, endDate);
      return res.status(200).json({ success: true, message: 'Proctoring summary retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({ success: false, message, error: 'ADMIN_PROCTORING_SUMMARY_FAILED' });
    }
  }

  async getProctoringSession(req: AuthenticatedRequest, res: Response) {
    try {
      const { session_id } = req.params;
      const data = await adminService.getProctoringSessionDetails(session_id);
      return res.status(200).json({ success: true, message: 'Proctoring session details retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      const code = message.includes('not found') ? 404 : 500;
      return res.status(code).json({ success: false, message, error: 'ADMIN_PROCTORING_SESSION_FAILED' });
    }
  }

  async getProctoringSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await adminService.getProctoringSettings();
      return res.status(200).json({ success: true, message: 'Proctoring settings retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({ success: false, message, error: 'ADMIN_PROCTORING_SETTINGS_FAILED' });
    }
  }

  async updateProctoringSettings(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED',
        });
      }

      const data = await adminService.updateProctoringSettings(userId, req.body);
      return res.status(200).json({ success: true, message: 'Proctoring settings updated', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_PROCTORING_SETTINGS_UPDATE_FAILED' });
    }
  }

  async listUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const data = await adminService.listUsers();
      return res.status(200).json({ success: true, message: 'Users retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({ success: false, message, error: 'ADMIN_USERS_FAILED' });
    }
  }

  async updateUserRole(req: AuthenticatedRequest, res: Response) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED',
        });
      }

      const { user_id } = req.params;
      const { role } = req.body as { role?: 'developer' | 'recruiter' | 'admin' };
      if (!role) {
        return res.status(400).json({ success: false, message: 'role is required' });
      }
      const data = await adminService.updateUserRole(adminUserId, user_id, role);
      return res.status(200).json({ success: true, message: 'User role updated', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(400).json({ success: false, message, error: 'ADMIN_USER_ROLE_UPDATE_FAILED' });
    }
  }

  async getAuditLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
      const data = await adminService.getAuditLogs(limit);
      return res.status(200).json({ success: true, message: 'Audit logs retrieved', data });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({ success: false, message, error: 'ADMIN_AUDIT_LOGS_FAILED' });
    }
  }

  async listFlaggedWorkExperience(req: AuthenticatedRequest, res: Response) {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
      const data = await adminService.listFlaggedWorkExperience(limit);
      return res.status(200).json({
        success: true,
        message: 'Flagged work experience entries retrieved',
        data,
      });
    } catch (error) {
      const message = safeErrorMessage(error, 'Request failed');
      return res.status(500).json({
        success: false,
        message,
        error: 'ADMIN_WORK_EXPERIENCE_FLAGGED_FAILED',
      });
    }
  }
}


