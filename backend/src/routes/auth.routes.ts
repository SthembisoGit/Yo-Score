import { Router, Request } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware'; 
import { rotateToken } from '../services/auth.token-rotate';

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: string;
        name: string;
        email: string;
        role: string;
      };
    }
  }
}

const router = Router();
const authController = new AuthController();

router.post('/signup', authController.signup.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authenticate, authController.logout.bind(authController));
router.post('/rotate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];
    const result = await rotateToken(token);
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    res.status(401).json({ message: 'Unauthorized', error: message });
  }
});

router.get('/validate', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ valid: false, error: 'Invalid token' });
    }
    res.json({
      valid: true,
      user: {
        user_id: req.user.user_id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

export default router;