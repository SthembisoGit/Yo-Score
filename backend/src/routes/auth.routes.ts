import { Router, Request } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware'; 

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
router.post('/logout', authenticate, authController.logout.bind(authController)); // Add authenticate here too

// Add authenticate middleware to validate route
router.get('/validate', authenticate, async (req, res) => {
  try {
    // The authenticate middleware already verified the token
    // and attached user to req.user
    
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
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

export default router;