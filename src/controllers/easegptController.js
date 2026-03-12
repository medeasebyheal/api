import { Mcq } from '../models/Mcq.js';
import { Ospe } from '../models/Ospe.js';
import { EaseGPTResponse } from '../models/EaseGPTResponse.js';
import { OspeEaseGPTResponse } from '../models/OspeEaseGPTResponse.js';
import { canAccessTopic, canAccessModule } from '../utils/access.js';
import { generateChatReply, generateOspeChatReply } from '../utils/easegptGemini.js';
import { rateLimitUser } from '../middleware/rateLimitParse.js';


const MAX_MESSAGE_LENGTH = 500;

function applyRateLimit(req, res) {
  return new Promise((resolve, reject) => {
    rateLimitUser(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * POST /api/mcqs/easegpt
 */
export const easegptChat = async (req, res, next) => {
  try {
    await applyRateLimit(req, res);

    const { mcqId, context, message, history } = req.body;

    if (!mcqId) {
      return res.status(400).json({ message: 'mcqId is required' });
    }

    const userMessage =
      typeof message === 'string'
        ? message.trim().slice(0, MAX_MESSAGE_LENGTH)
        : '';

    if (!userMessage) {
      return res
        .status(400)
        .json({ message: 'message is required and must be non-empty' });
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

    const cached = await EaseGPTResponse.findOne({
      mcq: mcqId,
      message: userMessage,
    })
      .select('reply')
      .lean();

    if (cached) {
      return res.json({ reply: cached.reply });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-20)
          .filter(
            (t) =>
              t &&
              (t.role === 'user' || t.role === 'model') &&
              typeof t.content === 'string'
          )
          .map((t) => ({
            role: t.role,
            content: t.content.slice(0, 2000),
          }))
      : [];

    const reply = await generateChatReply(context || {}, safeHistory, userMessage);

    try {
      await EaseGPTResponse.create({
        mcq: mcqId,
        message: userMessage,
        reply,
      });
    } catch (createErr) {
      if (createErr.code !== 11000) throw createErr;
    }

    res.json({ reply });
  } catch (err) {
    if (err.status === 429) {
      return res.status(429).json({
        message:
          err.message ||
          'AI is temporarily at capacity. Please try again in a few minutes.',
      });
    }
    next(err);
  }
};

function getFlatOspeQuestions(ospe) {
  if (ospe.stations && ospe.stations.length > 0) {
    return ospe.stations.flatMap((s) => s.questions || []);
  }
  return ospe.questions || [];
}

/**
 * POST /api/ospes/easegpt
 */
export const easegptOspeChat = async (req, res, next) => {
  try {
    await applyRateLimit(req, res);

    const { ospeId, questionIndex, mode, context, message, history } = req.body;

    if (!ospeId) {
      return res.status(400).json({ message: 'ospeId is required' });
    }

    if (typeof questionIndex !== 'number' || questionIndex < 0) {
      return res
        .status(400)
        .json({ message: 'questionIndex must be a non-negative number' });
    }

    const userMessage =
      typeof message === 'string'
        ? message.trim().slice(0, MAX_MESSAGE_LENGTH)
        : '';

    if (!userMessage) {
      return res
        .status(400)
        .json({ message: 'message is required and must be non-empty' });
    }

    const ospe = await Ospe.findById(ospeId);
    if (!ospe) {
      return res.status(404).json({ message: 'OSPE not found' });
    }

    const access = await canAccessModule(req.user._id, ospe.module.toString());
    if (!access.allowed) {
      return res.status(403).json({ message: 'Access denied to this module' });
    }

    const flatQuestions = getFlatOspeQuestions(ospe);
    const q = flatQuestions[questionIndex];

    if (!q) {
      return res
        .status(400)
        .json({ message: 'Invalid questionIndex for this OSPE' });
    }

    const qType = q.type || context?.type || '';
    const ospeMode = mode === 'viva' || qType === 'viva_written' ? 'viva' : 'mcq';

    const safeHistory = Array.isArray(history)
      ? history
          .slice(-20)
          .filter(
            (t) =>
              t &&
              (t.role === 'user' || t.role === 'model') &&
              typeof t.content === 'string'
          )
          .map((t) => ({
            role: t.role,
            content: t.content.slice(0, 2000),
          }))
      : [];

    const baseContext = {
      type: qType,
      questionText: q.questionText || q.question || '',
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex:
        typeof q.correctIndex === 'number' ? q.correctIndex : null,
      expectedAnswer: q.expectedAnswer || '',
      stationNote: context?.stationNote || '',
      imageDescription: context?.imageDescription || q.imageDescription || '',
      studentAnswer: context?.studentAnswer || '',
    };

    if (ospeMode === 'mcq') {
      baseContext.selectedIndex =
        typeof context?.selectedIndex === 'number'
          ? context.selectedIndex
          : null;

      const mcqContext = {
        question: baseContext.questionText,
        options: baseContext.options,
        correctIndex: baseContext.correctIndex,
        explanation: baseContext.expectedAnswer,
        selectedIndex: baseContext.selectedIndex,
        // include free-text student answer and image description for OSPE-style analysis
        studentAnswer: baseContext.studentAnswer,
        imageDescription: baseContext.imageDescription,
      };

      const reply = await generateOspeChatReply(
        mcqContext,
        safeHistory,
        userMessage,
        ospeMode
      );

      return res.json({ reply });
    }

    if (ospeMode === 'viva') {
      const cached = await OspeEaseGPTResponse.findOne({
        ospe: ospeId,
        questionIndex,
        message: userMessage,
      })
        .select('reply')
        .lean();

      if (cached) {
        return res.json({ reply: cached.reply });
      }

      const reply = await generateOspeChatReply(
        baseContext,
        safeHistory,
        userMessage,
        ospeMode
      );

      try {
        await OspeEaseGPTResponse.create({
          ospe: ospeId,
          questionIndex,
          message: userMessage,
          reply,
        });
      } catch (createErr) {
        if (createErr.code !== 11000) throw createErr;
      }

      return res.json({ reply });
    }

    const reply = await generateOspeChatReply(
      baseContext,
      safeHistory,
      userMessage,
      ospeMode
    );

    res.json({ reply });
  } catch (err) {
    if (err.status === 429) {
      return res.status(429).json({
        message:
          err.message ||
          'AI is temporarily at capacity for OSPE analysis. Please try again in a few minutes.',
      });
    }

    next(err);
  }
};