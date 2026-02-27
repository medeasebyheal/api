import { Router } from 'express';
import { publicApiLimiter } from '../middleware/publicRateLimit.js';
import { list, getOne } from '../controllers/packageController.js';

const router = Router();

router.use(publicApiLimiter);
router.get('/', list);
router.get('/:id', getOne);

export default router;
