import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware'; 
import { rotateToken } from '../services/auth.token-rotate';
import { authRateLimiter } from '../middleware/rateLimit.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: string;
      };
    }
  }
}

const router = Router();
const authController = new AuthController();

router.post('/signup', authRateLimiter, authController.signup.bind(authController));
router.post('/login', authRateLimiter, authController.login.bind(authController));
router.post('/logout', authenticate, authController.logout.bind(authController));
router.post('/rotate', authRateLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Missing token',
        error: 'MISSING_TOKEN',
      });
    }
    const token = authHeader.split(' ')[1];
    const result = await rotateToken(token);
    res.json({
      success: true,
      message: 'Token rotated',
      data: result,
    });
  } catch (error: unknown) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized',
      error: 'UNAUTHORIZED',
    });
  }
});

router.get('/validate', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        data: { valid: false },
      });
    }
    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        valid: true,
        user: {
          user_id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },
      },
    });
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      data: { valid: false },
      error: 'INVALID_TOKEN',
    });
  }
});

export default router;
