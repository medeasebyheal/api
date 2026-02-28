import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { list, getOne, update, verify, remove, block, unblock } from '../controllers/userController.js';

const router = Router();

router.use(auth);
router.use(requireRole('admin'));

router.get('/', list);
router.get('/:id', getOne);
router.put('/:id', update);
router.patch('/:id/verify', verify);
router.patch('/:id/block', block);
router.patch('/:id/unblock', unblock);
router.delete('/:id', remove);

export default router;
