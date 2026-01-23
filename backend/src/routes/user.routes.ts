import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { WorkExperienceController } from '../controllers/workExperience.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const userController = new UserController();
const workExperienceController = new WorkExperienceController();

router.use(authenticate);

// User profile routes
router.get('/me', userController.getProfile.bind(userController));
router.put('/me', userController.updateProfile.bind(userController));

// Work experience routes
router.post('/me/work-experience', workExperienceController.addWorkExperience.bind(workExperienceController));
router.get('/me/work-experience', workExperienceController.getWorkExperiences.bind(workExperienceController));

export default router;