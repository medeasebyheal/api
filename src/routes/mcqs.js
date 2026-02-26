import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { listByTopic, submitAttempt } from '../controllers/mcqController.js';
import { easegptChat } from '../controllers/easegptController.js';

const router = Router();

router.get('/topics/:topicId/mcqs', auth, listByTopic);
router.post('/attempts', auth, submitAttempt);
router.post('/easegpt', auth, easegptChat);

export default router;
