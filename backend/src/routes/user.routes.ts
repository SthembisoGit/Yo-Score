import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { WorkExperienceController } from '../controllers/workExperience.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { addWorkExperienceSchema, updateProfileSchema } from '../validation/schemas';

const router = Router();
const userController = new UserController();
const workExperienceController = new WorkExperienceController();

router.use(authenticate);

// User profile routes
router.get('/me', userController.getProfile.bind(userController));
router.put('/me', validateBody(updateProfileSchema), userController.updateProfile.bind(userController));

// Work experience routes
router.post(
  '/me/work-experience',
  validateBody(addWorkExperienceSchema),
  workExperienceController.addWorkExperience.bind(workExperienceController),
);
router.get('/me/work-experience', workExperienceController.getWorkExperiences.bind(workExperienceController));

export default router;
