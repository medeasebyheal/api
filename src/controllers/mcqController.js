import { Mcq } from '../models/Mcq.js';
import { McqAttempt } from '../models/McqAttempt.js';
import { canAccessTopic } from '../utils/access.js';
import { makeEtagFromString, maxUpdatedAtIso } from '../utils/etag.js';

export const listByTopic = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    const access = await canAccessTopic(req.user._id, req.params.topicId);
    const withTrial = req.user.freeTrialUsed?.toString() === req.params.topicId;
    if (!access.allowed && !withTrial) {
      return res.status(403).json({ message: 'Access denied to this topic' });
    }
    const mcqs = await Mcq.find({ topic: req.params.topicId }).sort({ createdAt: 1 }).lean();
    const maxUpdated = maxUpdatedAtIso(mcqs);
    const etag = makeEtagFromString(`${req.path}:${req.params.topicId}:${maxUpdated}`);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(mcqs);
  } catch (err) {
    next(err);
  }
};

export const submitAttempt = async (req, res, next) => {
  try {
    const { mcqId, selectedIndex } = req.body;
    const mcq = await Mcq.findById(mcqId);
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    const correct = mcq.correctIndex === Number(selectedIndex);
    await McqAttempt.create({
      user: req.user._id,
      mcq: mcqId,
      selectedIndex: Number(selectedIndex),
      correct,
    });
    res.json({
      correct,
      correctIndex: mcq.correctIndex,
      explanation: mcq.explanation ?? undefined,
    });
  } catch (err) {
    next(err);
  }
};
