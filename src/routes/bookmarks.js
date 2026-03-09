import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { createBookmark, deleteBookmark, listBookmarks } from '../controllers/bookmarkController.js';

const router = Router();

router.use(auth);

router.post('/', createBookmark);
router.get('/', listBookmarks);
router.delete('/:id', deleteBookmark);

export default router;

