import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware'; 
import { rotateToken } from '../services/auth.token-rotate';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { loginSecurityGuard } from '../middleware/loginSecurity.middleware';
import { config } from '../config';
import {
  extractRefreshTokenFromRequest,
  getRefreshCookieOptions,
} from '../utils/authCookie';
import { validateBody } from '../middleware/validate.middleware';
import { loginSchema, signupSchema } from '../validation/schemas';

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

router.post(
  '/signup',
  authRateLimiter,
  validateBody(signupSchema),
  authController.signup.bind(authController),
);
router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  loginSecurityGuard,
  authController.login.bind(authController),
);
router.post('/logout', authenticate, authController.logout.bind(authController));
router.post('/rotate', authRateLimiter, async (req, res) => {
  try {
    const refreshToken = extractRefreshTokenFromRequest(req);
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Missing refresh token',
        error: 'MISSING_TOKEN',
      });
    }
    const result = await rotateToken(refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    res.cookie(config.REFRESH_COOKIE_NAME, result.refresh_token, getRefreshCookieOptions());
    res.json({
      success: true,
      message: 'Token rotated',
      data: {
        token: result.token,
      },
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
