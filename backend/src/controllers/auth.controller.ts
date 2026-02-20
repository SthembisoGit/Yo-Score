import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { safeErrorMessage } from '../utils/safeErrorMessage';

const authService = new AuthService();

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

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: result
      });

    } catch (error) {
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
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const result = await authService.login(normalizedEmail, String(password));

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });

    } catch (error) {
      const message = safeErrorMessage(error, 'Login failed', ['Invalid credentials']);
      
      return res.status(401).json({
        success: false,
        message,
        error: 'INVALID_CREDENTIALS'
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (token) {
        await authService.logout(token);
      }

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      const message = safeErrorMessage(error, 'Logout failed');
      
      return res.status(500).json({
        success: false,
        message,
        error: 'LOGOUT_FAILED'
      });
    }
  }
}
