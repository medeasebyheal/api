import { Mcq } from '../models/Mcq.js';
import { EaseGPTResponse } from '../models/EaseGPTResponse.js';
import { canAccessTopic } from '../utils/access.js';
import { generateChatReply } from '../utils/easegptGemini.js';

const MAX_MESSAGE_LENGTH = 500;

/**
 * POST /api/mcqs/easegpt
 * Body: { mcqId, context?, message, history? }
 * Returns cached reply if same (mcqId, message) was asked before; otherwise calls Gemini (tries next key on 429) and stores response.
 */
export const easegptChat = async (req, res, next) => {
  try {
    const { mcqId, context, message, history } = req.body;

    if (!mcqId) {
      return res.status(400).json({ message: 'mcqId is required' });
    }

    const userMessage = typeof message === 'string' ? message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
    if (!userMessage) {
      return res.status(400).json({ message: 'message is required and must be non-empty' });
    }

    const mcq = await Mcq.findById(mcqId).select('topic').lean();
    if (!mcq) {
      return res.status(404).json({ message: 'MCQ not found' });
    }

    const topicId = mcq.topic?.toString?.() || mcq.topic;
    if (!topicId) {
      return res.status(400).json({ message: 'MCQ has no topic' });
    }

    const access = await canAccessTopic(req.user._id, topicId);
    if (!access.allowed) {
      return res.status(403).json({ message: 'Access denied to this topic' });
    }

    const cached = await EaseGPTResponse.findOne({ mcq: mcqId, message: userMessage }).select('reply').lean();
    if (cached) {
      return res.json({ reply: cached.reply });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-20)
          .filter((t) => t && (t.role === 'user' || t.role === 'model') && typeof t.content === 'string')
          .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }))
      : [];

    const reply = await generateChatReply(context || {}, safeHistory, userMessage);
    try {
      await EaseGPTResponse.create({ mcq: mcqId, message: userMessage, reply });
    } catch (createErr) {
      if (createErr.code !== 11000) throw createErr;
    }
    res.json({ reply });
  } catch (err) {
    if (err.status === 429) {
      return res.status(429).json({ message: err.message || 'AI is temporarily at capacity. Please try again in a few minutes.' });
    }
    next(err);
  }
};
