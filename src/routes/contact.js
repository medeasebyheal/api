import { Router } from 'express';
import { contactLimiter } from '../middleware/publicRateLimit.js';
import { submit } from '../controllers/contactController.js';

const router = Router();
router.post('/', contactLimiter, submit);
export default router;
