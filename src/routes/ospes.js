import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { listByModule, getOne, submitAttempt } from '../controllers/ospeController.js';
import { easegptOspeChat } from '../controllers/easegptController.js';

const router = Router();

router.get('/modules/:moduleId', auth, listByModule);
router.get('/:id', auth, getOne);
router.post('/attempts', auth, submitAttempt);
router.post('/easegpt', auth, easegptOspeChat);

export default router;
