import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();
const authController = new AuthController();

router.post('/signup', authController.signup.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authController.logout.bind(authController));

export default router;