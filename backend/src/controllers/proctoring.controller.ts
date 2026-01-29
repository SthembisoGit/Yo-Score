import { Request, Response } from 'express';
import { ProctoringService } from '../services/proctoring.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class ProctoringController {
  private proctoringService = new ProctoringService();

  async startSession(req: AuthenticatedRequest, res: Response) {
    try {
      const { challengeId } = req.body;
      
      if (!challengeId) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID is required'
        });
      }

      const sessionId = await this.proctoringService.startSession(
        req.user.id,
        challengeId
      );

      return res.status(201).json({
        success: true,
        message: 'Proctoring session started',
        data: { sessionId }
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to start proctoring session',
        error: error.message
      });
    }
  }

  async endSession(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId, submissionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      await this.proctoringService.endSession(sessionId, submissionId);

      return res.status(200).json({
        success: true,
        message: 'Proctoring session ended'
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to end proctoring session',
        error: error.message
      });
    }
  }

  async logViolation(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId, type, description } = req.body;
      
      if (!sessionId || !type) {
        return res.status(400).json({
          success: false,
          message: 'Session ID and violation type are required'
        });
      }

      const violation = await this.proctoringService.logViolation(
        sessionId,
        req.user.id,
        type,
        description
      );

      return res.status(201).json({
        success: true,
        message: 'Violation logged',
        data: violation
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to log violation',
        error: error.message
      });
    }
  }

  async getSessionDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      const sessionDetails = await this.proctoringService.getSessionDetails(sessionId);

      return res.status(200).json({
        success: true,
        message: 'Session details retrieved',
        data: sessionDetails
      });

    } catch (error: any) {
      if (error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to get session details',
        error: error.message
      });
    }
  }
}