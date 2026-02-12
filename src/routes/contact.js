import { Router } from 'express';
import { submit } from '../controllers/contactController.js';

const router = Router();
router.post('/', submit);
export default router;
