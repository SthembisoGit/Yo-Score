import { Request, Response } from 'express';
import { SubmissionService } from '../services/submission.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { safeErrorMessage } from '../utils/safeErrorMessage';

const submissionService = new SubmissionService();

export class SubmissionController {
  async submitChallenge(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { challenge_id, code, language, session_id, timeout_submit } = req.body;

      if (!challenge_id || !code || !language) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID, code, and language are required'
        });
      }

      const result = await submissionService.createSubmission(req.user.id, {
        challenge_id,
        code,
        language,
        session_id,
        timeout_submit: timeout_submit === true || timeout_submit === 'true',
      });

      return res.status(201).json({
        success: true,
        message: 'Submission received',
        data: {
          submission_id: result.submission_id,
          status: result.status,
          judge_status: result.judge_status,
          message: result.message
        }
      });

    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to submit challenge');

      if (message.includes('still in progress')) {
        return res.status(409).json({
          success: false,
          message,
          error: 'SUBMISSION_RETRYABLE',
        });
      }
      
      return res.status(400).json({
        success: false,
        message,
        error: 'SUBMISSION_FAILED'
      });
    }
  }

  async getSubmissionResult(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { submission_id } = req.params;

      if (!submission_id) {
        return res.status(400).json({
          success: false,
          message: 'Submission ID is required'
        });
      }

      const result = await submissionService.getSubmissionById(submission_id, req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Submission results retrieved',
        data: result
      });

    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to get submission results', [
        'Submission not found',
      ]);
      
      if (message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message,
          error: 'SUBMISSION_NOT_FOUND'
        });
      }

      return res.status(400).json({
        success: false,
        message,
        error: 'FETCH_SUBMISSION_FAILED'
      });
    }
  }

  async getUserSubmissions(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const submissions = await submissionService.getUserSubmissions(req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Submissions retrieved successfully',
        data: submissions
      });

    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to get submissions');
      
      return res.status(400).json({
        success: false,
        message,
        error: 'FETCH_SUBMISSIONS_FAILED'
      });
    }
  }

  async getSubmissionRuns(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }
      const { submission_id } = req.params;
      if (!submission_id) {
        return res.status(400).json({
          success: false,
          message: 'Submission ID is required',
        });
      }

      const runs = await submissionService.getSubmissionRuns(submission_id, req.user.id);
      return res.status(200).json({
        success: true,
        message: 'Submission runs retrieved',
        data: runs,
      });
    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to get submission runs', ['Submission not found']);
      const statusCode = message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message,
        error: 'FETCH_SUBMISSION_RUNS_FAILED',
      });
    }
  }

  async getSubmissionRunDetails(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }
      const { submission_id, run_id } = req.params;
      if (!submission_id || !run_id) {
        return res.status(400).json({
          success: false,
          message: 'Submission ID and run ID are required',
        });
      }

      const details = await submissionService.getSubmissionRunDetails(
        submission_id,
        run_id,
        req.user.id,
      );
      return res.status(200).json({
        success: true,
        message: 'Submission run details retrieved',
        data: details,
      });
    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to get submission run details', [
        'Submission not found',
        'Run not found',
      ]);
      const statusCode = message.includes('not found') ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message,
        error: 'FETCH_SUBMISSION_RUN_FAILED',
      });
    }
  }
}
