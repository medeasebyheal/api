import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { auth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import {
  listProff,
  listYears,
  listModules,
  listSubjects,
  listTopics,
  getTopic,
  checkTopicAccess,
  checkModuleAccess,
} from '../controllers/contentController.js';

const router = Router();

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (user) req.user = user;
  } catch (_) {}
  next();
}

router.get('/proff', listProff);
router.get('/years', listYears);
router.get('/years/:yearId/modules', listModules);
router.get('/modules/:moduleId/subjects', listSubjects);
router.get('/subjects/:subjectId/topics', listTopics);
router.get('/topics/:id', optionalAuth, getTopic);
router.get('/topics/:id/access', auth, checkTopicAccess);
router.get('/modules/:moduleId/access', auth, checkModuleAccess);

export default router;
