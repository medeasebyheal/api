import { Ospe } from '../models/Ospe.js';
import { OspeAttempt } from '../models/OspeAttempt.js';
import { canAccessModule } from '../utils/access.js';
import { evaluateOspeWrittenAnswer } from '../utils/ospeEvaluateOpenAI.js';

/** Normalize for fallback string comparison: lowercase, trim, collapse spaces. */
function normalizeForCompare(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Flatten stations or legacy questions into a single list for answer indexing */
function getFlatQuestions(ospe) {
  return (ospe.stations && ospe.stations.length > 0)
    ? ospe.stations.flatMap((s) => s.questions || [])
    : (ospe.questions || []);
}

export const listByModule = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const access = await canAccessModule(req.user._id, req.params.moduleId);

    if (!access.allowed) {
      return res.status(403).json({ message: 'Access denied to this module' });
    }

    const ospes = await Ospe.find({ module: req.params.moduleId })
      .sort({ createdAt: 1 })
      .lean();

    res.json(ospes);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const ospe = await Ospe.findById(req.params.id).populate('module');

    if (!ospe) {
      return res.status(404).json({ message: 'OSPE not found' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const access = await canAccessModule(req.user._id, ospe.module._id);

    if (!access.allowed) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const doc = ospe.toObject ? ospe.toObject() : ospe;

    if (!doc.stations?.length && doc.questions?.length) {
      doc.stations = doc.questions.map((q) => ({
        imageUrl: q.imageUrl,
        questions: [{ ...q, imageUrl: undefined }],
      }));
    }

    res.json(doc);
  } catch (err) {
    next(err);
  }
};

export const submitAttempt = async (req, res, next) => {
  try {
    const { ospeId, answers } = req.body;

    const ospe = await Ospe.findById(ospeId);

    if (!ospe) {
      return res.status(404).json({ message: 'OSPE not found' });
    }

    const access = await canAccessModule(req.user._id, ospe.module.toString());

    if (!access.allowed) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const flatQuestions = getFlatQuestions(ospe);
    const mcqTypes = ['picture_mcq', 'text_mcq', 'guess_until_correct'];

    const answerList = await Promise.all((answers || []).map(async (a, i) => {
      const qIndex = a.questionIndex ?? i;
      const q = flatQuestions[qIndex];

      let correct = false;
      let correctnessPercentage = null;
      let assessment = null;

      if (q) {
        if (mcqTypes.includes(q.type) && q.correctIndex != null) {
          correct = q.correctIndex === Number(a.selectedIndex);
          if (correct) correctnessPercentage = 100;
          else correctnessPercentage = 0;
          assessment = correct ? 'Correct' : 'Incorrect';
        } else {
          const written = (a.writtenAnswer || '').trim();
          const expected = (q.expectedAnswer || '').trim();
          if (written && expected && process.env.OPENAI_API_KEY) {
            try {
              const result = await evaluateOspeWrittenAnswer({
                questionText: q.questionText || q.question || '',
                expectedAnswer: expected,
                userAnswer: written,
              });
              assessment = result.assessment;
              correctnessPercentage = result.percentage;
              correct = result.percentage >= 60;
            } catch (_) {
              const nWritten = normalizeForCompare(written);
              const nExpected = normalizeForCompare(expected);
              correct = nWritten === nExpected;
              correctnessPercentage = correct ? 100 : 0;
              assessment = correct ? 'Correct' : 'Incorrect';
            }
          } else {
            const nWritten = normalizeForCompare(written);
            const nExpected = normalizeForCompare(expected);
            correct = nWritten === nExpected;
            correctnessPercentage = correct ? 100 : 0;
            assessment = correct ? 'Correct' : 'Incorrect';
          }
        }
      }

      return {
        questionIndex: qIndex,
        selectedIndex: a.selectedIndex,
        writtenAnswer: a.writtenAnswer,
        correct,
        correctnessPercentage,
        assessment,
      };
    }));

    await OspeAttempt.create({
      user: req.user._id,
      ospe: ospeId,
      answers: answerList,
    });

    res.json({ saved: true, answers: answerList });
  } catch (err) {
    next(err);
  }
};