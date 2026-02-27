import { Router } from 'express';
import { promoCodeLimiter } from '../middleware/publicRateLimit.js';
import { validate } from '../controllers/promoCodeController.js';

const router = Router();
router.post('/validate', promoCodeLimiter, validate);

export default router;
