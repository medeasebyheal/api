import { Mcq } from '../models/Mcq.js';
import { McqAttempt } from '../models/McqAttempt.js';
import { canAccessTopic } from '../utils/access.js';

export const listByTopic = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    const access = await canAccessTopic(req.user._id, req.params.topicId);
    const withTrial = req.user.freeTrialUsed?.toString() === req.params.topicId;
    if (!access.allowed && !withTrial) {
      return res.status(403).json({ message: 'Access denied to this topic' });
    }
    const mcqs = await Mcq.find({ topic: req.params.topicId }).sort({ order: 1 });
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
      correctIndex: correct ? mcq.correctIndex : undefined,
      explanation: correct ? mcq.explanation : undefined,
      videoUrl: correct ? (mcq.videoUrl || null) : undefined,
    });
  } catch (err) {
    next(err);
  }
};
