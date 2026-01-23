import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export class AuthController {
  async signup(req: Request, res: Response) {
    try {
      const { name, email, password, role } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }

      const result = await authService.signup(name, email, password, role);

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: result
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      
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

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const result = await authService.login(email, password);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      
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
      const message = error instanceof Error ? error.message : 'Logout failed';
      
      return res.status(500).json({
        success: false,
        message,
        error: 'LOGOUT_FAILED'
      });
    }
  }
}