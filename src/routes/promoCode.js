import { Router } from 'express';
import { validate } from '../controllers/promoCodeController.js';

const router = Router();
router.post('/validate', validate);

export default router;
