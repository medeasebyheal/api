import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { apply } from '../controllers/packageApplyController.js';

const router = Router();

router.post('/', auth, requireRole('student'), apply);

export default router;
