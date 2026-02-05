import { Request, Response } from 'express';
import { ChallengeService } from '../services/challenge.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const challengeService = new ChallengeService();

export class ChallengeController {
  async listChallenges(req: Request, res: Response) {
    try {
      const challenges = await challengeService.getAllChallenges();

      return res.status(200).json({
        success: true,
        message: 'Challenges retrieved successfully',
        data: challenges
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve challenges';
      
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

      const challenge = await challengeService.getChallengeById(challenge_id);

      return res.status(200).json({
        success: true,
        message: 'Challenge details retrieved successfully',
        data: challenge
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve challenge';
      
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
      const challenge = await challengeService.getNextChallengeForUser(req.user.id);
      return res.status(200).json({
        success: true,
        message: 'Next challenge retrieved',
        data: challenge
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get next challenge';
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
      const { title, description, category, difficulty } = req.body;

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
        difficulty
      });

      return res.status(201).json({
        success: true,
        message: 'Challenge created successfully',
        data: challenge
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create challenge';
      
      return res.status(400).json({
        success: false,
        message,
        error: 'CHALLENGE_CREATION_FAILED'
      });
    }
  }
}