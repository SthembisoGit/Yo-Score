import { Response } from 'express';

import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { UserService } from '../services/user.service';
import { safeErrorMessage } from '../utils/safeErrorMessage';

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
      const message = safeErrorMessage(error, 'Failed to get profile', ['User not found']);
      
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
      const {
        avatar_url,
        headline,
        bio,
        location,
        github_url,
        linkedin_url,
        portfolio_url,
      } = req.body;

      if (
        name === undefined &&
        email === undefined &&
        avatar_url === undefined &&
        headline === undefined &&
        bio === undefined &&
        location === undefined &&
        github_url === undefined &&
        linkedin_url === undefined &&
        portfolio_url === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: 'At least one profile field is required'
        });
      }

      const user = await userService.updateUser(req.user.id, {
        name:
          typeof name === 'string'
            ? (name.trim() || undefined)
            : undefined,
        email:
          typeof email === 'string'
            ? (email.trim() || undefined)
            : undefined,
        avatar_url:
          avatar_url === null
            ? null
            : avatar_url === ''
            ? null
            : typeof avatar_url === 'string'
              ? avatar_url.trim()
              : undefined,
        headline:
          headline === null
            ? null
            : headline === ''
            ? null
            : typeof headline === 'string'
              ? headline.trim()
              : undefined,
        bio:
          bio === null
            ? null
            : bio === ''
            ? null
            : typeof bio === 'string'
              ? bio.trim()
              : undefined,
        location:
          location === null
            ? null
            : location === ''
            ? null
            : typeof location === 'string'
              ? location.trim()
              : undefined,
        github_url:
          github_url === null
            ? null
            : github_url === ''
            ? null
            : typeof github_url === 'string'
              ? github_url.trim()
              : undefined,
        linkedin_url:
          linkedin_url === null
            ? null
            : linkedin_url === ''
            ? null
            : typeof linkedin_url === 'string'
              ? linkedin_url.trim()
              : undefined,
        portfolio_url:
          portfolio_url === null
            ? null
            : portfolio_url === ''
            ? null
            : typeof portfolio_url === 'string'
              ? portfolio_url.trim()
              : undefined,
      });

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });

    } catch (error) {
      const message = safeErrorMessage(error, 'Failed to update profile', ['Email already in use']);
      
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
