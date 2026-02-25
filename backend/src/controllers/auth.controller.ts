import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { safeErrorMessage } from '../utils/safeErrorMessage';
import { config } from '../config';
import { extractRefreshTokenFromRequest, getRefreshCookieOptions } from '../utils/authCookie';
import { logger } from '../utils/logger';

const authService = new AuthService();

const getRequestIp = (req: Request): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip || 'unknown';
};

export class AuthController {
  async signup(req: Request, res: Response) {
    try {
      const { name, email, password, role } = req.body;
      const normalizedName = typeof name === 'string' ? name.trim() : '';
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

      // Validate required fields
      if (!normalizedName || !normalizedEmail || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }

      const result = await authService.signup(normalizedName, normalizedEmail, String(password), role);
      if (result.refresh_token) {
        res.cookie(config.REFRESH_COOKIE_NAME, result.refresh_token, getRefreshCookieOptions());
      }

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          message: 'User created successfully',
          user_id: result.user.user_id,
        },
      });

    } catch (error) {
      logger.warn('Signup request failed', { error });
      const message = safeErrorMessage(error, 'Signup failed', ['User already exists']);
      
      return res.status(400).json({
        success: false,
        message,
        error: 'SIGNUP_FAILED'
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

      if (!normalizedEmail || !password) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          error: 'INVALID_CREDENTIALS',
        });
      }

      const result = await authService.login(normalizedEmail, String(password), {
        userAgent: req.headers['user-agent'],
        ipAddress: getRequestIp(req),
      });
      if (result.refresh_token) {
        res.cookie(config.REFRESH_COOKIE_NAME, result.refresh_token, getRefreshCookieOptions());
      }

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token: result.token,
          user: result.user,
        }
      });

    } catch (error) {
      logger.warn('Login request failed', { error });
      const message = safeErrorMessage(error, 'Login failed', ['Invalid credentials']);
      
      return res.status(401).json({
        success: false,
        message: message === 'Invalid credentials' ? message : 'Invalid credentials',
        error: 'INVALID_CREDENTIALS'
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const refreshToken = extractRefreshTokenFromRequest(req) || undefined;
      
      if (token) {
        await authService.logout(token, refreshToken);
      }
      res.clearCookie(config.REFRESH_COOKIE_NAME, getRefreshCookieOptions());

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      logger.error('Logout request failed', { error });
      const message = safeErrorMessage(error, 'Logout failed');
      
      return res.status(500).json({
        success: false,
        message,
        error: 'LOGOUT_FAILED'
      });
    }
  }
}
