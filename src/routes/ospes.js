import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { listByModule, getOne, submitAttempt } from '../controllers/ospeController.js';

const router = Router();

router.get('/modules/:moduleId', auth, listByModule);
router.get('/:id', auth, getOne);
router.post('/attempts', auth, submitAttempt);

export default router;
