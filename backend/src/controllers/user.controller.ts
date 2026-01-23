import { Request, Response } from 'express';

import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { UserService } from '../services/user.service';

const userService = new UserService();

export class UserController {
  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const user = await userService.getUserById(req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: user
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get profile';
      
      return res.status(404).json({
        success: false,
        message,
        error: 'USER_NOT_FOUND'
      });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { name, email } = req.body;

      if (!name && !email) {
        return res.status(400).json({
          success: false,
          message: 'At least one field (name or email) is required'
        });
      }

      const user = await userService.updateUser(req.user.id, { name, email });

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      
      let status = 400;
      let errorCode = 'UPDATE_FAILED';

      if (message.includes('already in use')) {
        status = 409;
        errorCode = 'EMAIL_EXISTS';
      }

      return res.status(status).json({
        success: false,
        message,
        error: errorCode
      });
    }
  }
}