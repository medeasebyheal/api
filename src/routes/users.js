import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth.js';
import { list, getOne, update, verify, remove, block, unblock, revokeAccess } from '../controllers/userController.js';

const router = Router();

router.use(auth);

// Only superadmin can access the users listing
router.get('/', requireRole('superadmin'), list);

// Other user management actions remain admin-only (admins and superadmins)
router.get('/:id', requireRole('admin'), getOne);
router.put('/:id', requireRole('admin'), update);
router.patch('/:id/verify', requireRole('admin'), verify);
router.patch('/:id/block', requireRole('admin'), block);
router.patch('/:id/unblock', requireRole('admin'), unblock);
router.delete('/:id', requireRole('admin'), remove);
router.patch('/:id/revoke', requireRole('admin'), revokeAccess);

export default router;
