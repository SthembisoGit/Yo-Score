import { Request, Response } from 'express';
import { ChallengeService } from '../services/challenge.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { coachService } from '../services/coach.service';
import { coachChatService, type CoachChatMessage } from '../services/coachChat.service';
import { safeErrorMessage } from '../utils/safeErrorMessage';
import type { SupportedLanguage } from '../constants/languages';

const challengeService = new ChallengeService();

export class ChallengeController {
  async listChallenges(req: Request, res: Response) {
    try {
      const challenges = await challengeService.getAllChallenges({ readyOnly: true });

      return res.status(200).json({
        success: true,
        message: 'Challenges retrieved successfully',
        data: challenges
      });

    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to retrieve challenges');
      
      return res.status(500).json({
        success: false,
        message,
        error: 'CHALLENGES_FETCH_FAILED'
      });
    }
  }

  async getChallengeDetails(req: Request, res: Response) {
    try {
      const { challenge_id } = req.params;

      if (!challenge_id) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID is required'
        });
      }

      const challenge = await challengeService.getChallengeById(challenge_id, { readyOnly: true });

      return res.status(200).json({
        success: true,
        message: 'Challenge details retrieved successfully',
        data: challenge
      });

    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to retrieve challenge', ['Challenge not found']);
      
      if (message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message,
          error: 'CHALLENGE_NOT_FOUND'
        });
      }

      return res.status(500).json({
        success: false,
        message,
        error: 'CHALLENGE_FETCH_FAILED'
      });
    }
  }

  async getNextChallenge(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED'
        });
      }
      const category = req.query.category ? String(req.query.category) : undefined;
      const challenge = await challengeService.getNextChallengeForUser(req.user.id, category);
      return res.status(200).json({
        success: true,
        message: 'Next challenge retrieved',
        data: challenge
      });
    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to get next challenge', ['No challenges available']);
      if (message.includes('No challenges available')) {
        return res.status(404).json({
          success: false,
          message,
          error: 'NO_CHALLENGES_AVAILABLE'
        });
      }
      return res.status(500).json({
        success: false,
        message,
        error: 'CHALLENGE_FETCH_FAILED'
      });
    }
  }

  async createChallenge(req: Request, res: Response) {
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
          message: 'Title, description, category, and difficulty are required'
        });
      }

      const challenge = await challengeService.createChallenge({
        title,
        description,
        category,
        difficulty,
        target_seniority,
        duration_minutes,
        publish_status,
        supported_languages,
      });

      return res.status(201).json({
        success: true,
        message: 'Challenge created successfully',
        data: challenge
      });

    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to create challenge');
      
      return res.status(400).json({
        success: false,
        message,
        error: 'CHALLENGE_CREATION_FAILED'
      });
    }
  }

  async getCoachHint(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED',
        });
      }

      const { challenge_id } = req.params;
      if (!challenge_id) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID is required',
        });
      }

      const { session_id, language, code, hint_index } = req.body as {
        session_id?: string;
        language?: SupportedLanguage;
        code?: string;
        hint_index?: number;
      };

      if (!language || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'language and code are required',
        });
      }

      const data = await coachService.getHintForChallenge(req.user.id, challenge_id, {
        session_id,
        language,
        code,
        hint_index,
      });

      return res.status(200).json({
        success: true,
        message: 'Coach hint generated',
        data,
      });
    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to generate coach hint', [
        'Hint limit reached for this challenge session.',
      ]);
      const statusCode = message.includes('limit reached') ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message,
        error: 'COACH_HINT_FAILED',
      });
    }
  }

  async postCoachChat(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
          error: 'UNAUTHORIZED',
        });
      }

      const { challenge_id } = req.params;
      if (!challenge_id) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID is required',
          error: 'VALIDATION_FAILED',
        });
      }

      const { session_id, language, code, messages, run_context } = req.body as {
        session_id?: string;
        language?: SupportedLanguage;
        code?: string;
        messages?: CoachChatMessage[];
        run_context?: {
          stdout?: string;
          stderr?: string;
          exit_code?: number;
          timed_out?: boolean;
          runtime_ms?: number;
          memory_kb?: number;
          provider?: string;
        };
      };

      if (!session_id || !language || typeof code !== 'string' || !Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          message: 'session_id, language, code, and messages[] are required',
          error: 'VALIDATION_FAILED',
        });
      }

      const normalizedMessages = messages
        .filter(
          (message): message is CoachChatMessage =>
            Boolean(message) &&
            (message.role === 'user' || message.role === 'assistant') &&
            typeof message.content === 'string',
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      if (normalizedMessages.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one chat message is required',
          error: 'VALIDATION_FAILED',
        });
      }

      const data = await coachChatService.getChatForChallenge(req.user.id, challenge_id, {
        session_id,
        language,
        code,
        messages: normalizedMessages,
        run_context,
      });

      return res.status(200).json({
        success: true,
        message: 'Coach chat response generated',
        data,
      });
    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to generate coach chat response');
      const lower = message.toLowerCase();
      const statusCode = lower.includes('limit reached')
        ? 429
        : lower.includes('not configured')
          ? 503
          : lower.includes('invalid session') ||
              lower.includes('challenge not found') ||
              lower.includes('completed sessions')
            ? 400
            : 500;

      return res.status(statusCode).json({
        success: false,
        message,
        error: 'COACH_CHAT_FAILED',
      });
    }
  }
}
