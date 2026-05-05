import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { ContentVisit } from '../models/ContentVisit.js';

const router = Router();
router.use(auth);

router.post('/track-visit', async (req, res, next) => {
  try {
    const { contentType, contentId } = req.body;
    
    if (!contentType || !contentId) {
      return res.status(400).json({ message: 'contentType and contentId are required' });
    }

    if (!['module', 'subject', 'topic', 'ospe'].includes(contentType)) {
      return res.status(400).json({ message: 'Invalid contentType' });
    }

    await ContentVisit.create({
      user: req.user._id,
      contentType,
      contentId,
    });

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
