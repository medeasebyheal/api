import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { listByTopic, submitAttempt } from '../controllers/mcqController.js';

const router = Router();

router.get('/topics/:topicId/mcqs', auth, listByTopic);
router.post('/attempts', auth, submitAttempt);

export default router;
