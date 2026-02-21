import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { codeRunService } from '../services/codeRun.service';
import { safeErrorMessage } from '../utils/safeErrorMessage';

export class CodeController {
  async runCode(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED',
        });
      }

      const { language, code, stdin, challenge_id } = req.body as {
        language?: string;
        code?: string;
        stdin?: string;
        challenge_id?: string;
      };

      if (!language || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'language and code are required',
          error: 'VALIDATION_FAILED',
        });
      }

      const data = await codeRunService.runCode(req.user.id, {
        language,
        code,
        stdin,
        challenge_id,
      });

      return res.status(200).json({
        success: true,
        message: 'Code executed',
        data,
      });
    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to run code');
      const statusCode =
        message.includes('not published') || message.includes('not found') ? 400 : 502;
      return res.status(statusCode).json({
        success: false,
        message,
        error: 'CODE_RUN_FAILED',
      });
    }
  }
}

export const codeController = new CodeController();
