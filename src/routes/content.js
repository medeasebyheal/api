import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { auth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import {
  listProff,
  listYears,
  listModules,
  getModule,
  listSubjects,
  getSubject,
  listTopics,
  getTopic,
  listTopicResources,
  listSubjectOneShotLectures,
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
router.get('/modules/:moduleId', getModule);
router.get('/modules/:moduleId/subjects', listSubjects);
router.get('/subjects/:subjectId', getSubject);
router.get('/subjects/:subjectId/topics', listTopics);
router.get('/subjects/:subjectId/one-shot-lectures', listSubjectOneShotLectures);
router.get('/topics/:id', optionalAuth, getTopic);
router.get('/topics/:topicId/resources', listTopicResources);
router.get('/topics/:id/access', auth, checkTopicAccess);
router.get('/modules/:moduleId/access', auth, checkModuleAccess);

export default router;
