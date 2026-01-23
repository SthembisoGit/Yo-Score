import { Request, Response } from 'express';
import { SubmissionService } from '../services/submission.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

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

      const { challenge_id, code } = req.body;

      if (!challenge_id || !code) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID and code are required'
        });
      }

      const result = await submissionService.createSubmission(req.user.id, {
        challenge_id,
        code
      });

      return res.status(201).json({
        success: true,
        message: 'Submission received',
        data: result
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit challenge';
      
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
      const message = error instanceof Error ? error.message : 'Failed to get submission results';
      
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
      const message = error instanceof Error ? error.message : 'Failed to get submissions';
      
      return res.status(400).json({
        success: false,
        message,
        error: 'FETCH_SUBMISSIONS_FAILED'
      });
    }
  }
}