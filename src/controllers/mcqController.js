import { Mcq } from '../models/Mcq.js';
import { McqAttempt } from '../models/McqAttempt.js';
import { TopicAttempt } from '../models/TopicAttempt.js';
import { canAccessTopic } from '../utils/access.js';

export const listByTopic = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    const access = await canAccessTopic(req.user._id, req.params.topicId);
    const withTrial = req.user.freeTrialUsed?.toString() === req.params.topicId;
    if (!access.allowed && !withTrial) {
      return res.status(403).json({ message: 'Access denied to this topic' });
    }
    const mcqs = await Mcq.find({ topic: req.params.topicId }).sort({ createdAt: 1 }).lean();
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

export const submitTopicQuizSession = async (req, res, next) => {
  try {
    const { topicId, attempts, timeTakenSeconds } = req.body;
    if (!topicId || !Array.isArray(attempts)) {
      return res.status(400).json({ message: 'Invalid request data' });
    }

    const mcqIds = attempts.map(a => a.mcqId);
    const mcqs = await Mcq.find({ _id: { $in: mcqIds } });
    const mcqMap = new Map(mcqs.map(m => [m._id.toString(), m]));

    let correctCount = 0;
    const attemptDocs = [];

    for (const attempt of attempts) {
      const mcq = mcqMap.get(attempt.mcqId);
      if (!mcq) continue;

      const isCorrect = mcq.correctIndex === Number(attempt.selectedIndex);
      if (isCorrect) correctCount++;

      attemptDocs.push({
        user: req.user._id,
        mcq: attempt.mcqId,
        selectedIndex: Number(attempt.selectedIndex),
        correct: isCorrect,
      });
    }

    // Bulk create McqAttempts
    if (attemptDocs.length > 0) {
      await McqAttempt.insertMany(attemptDocs);
    }

    // Create TopicAttempt session
    const topicAttempt = await TopicAttempt.create({
      user: req.user._id,
      topic: topicId,
      score: correctCount,
      totalMcqs: attempts.length,
      timeTakenSeconds: timeTakenSeconds || 0,
    });

    res.json({
      success: true,
      topicAttempt,
      correctCount,
      totalMcqs: attempts.length
    });
  } catch (err) {
    next(err);
  }
};