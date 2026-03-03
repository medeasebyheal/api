import { Ospe } from '../models/Ospe.js';
import { OspeAttempt } from '../models/OspeAttempt.js';
import { canAccessModule } from '../utils/access.js';
import { makeEtagFromString, maxUpdatedAtIso } from '../utils/etag.js';

/** Flatten stations or legacy questions into a single list for answer indexing */
function getFlatQuestions(ospe) {
  if (ospe.stations && ospe.stations.length > 0) {
    return ospe.stations.flatMap((s) => s.questions || []);
  }
  return ospe.questions || [];
}

export const listByModule = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    const access = await canAccessModule(req.user._id, req.params.moduleId);
    if (!access.allowed) {
      return res.status(403).json({ message: 'Access denied to this module' });
    }
    const ospes = await Ospe.find({ module: req.params.moduleId }).sort({ createdAt: 1 }).lean();
    const maxUpdated = maxUpdatedAtIso(ospes);
    const etag = makeEtagFromString(`${req.path}:${req.params.moduleId}:${maxUpdated}`);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(ospes);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const ospe = await Ospe.findById(req.params.id).populate('module');
    if (!ospe) return res.status(404).json({ message: 'OSPE not found' });
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    const access = await canAccessModule(req.user._id, ospe.module._id);
    if (!access.allowed) return res.status(403).json({ message: 'Access denied' });
    const doc = ospe.toObject ? ospe.toObject() : ospe;
    if (!doc.stations?.length && doc.questions?.length) {
      doc.stations = doc.questions.map((q) => ({
        imageUrl: q.imageUrl,
        questions: [{ ...q, imageUrl: undefined }],
      }));
    }
    const maxUpdated = maxUpdatedAtIso([doc]);
    const etag = makeEtagFromString(`${req.path}:${req.params.id}:${maxUpdated}`);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

export const submitAttempt = async (req, res, next) => {
  try {
    const { ospeId, answers } = req.body;
    const ospe = await Ospe.findById(ospeId);
    if (!ospe) return res.status(404).json({ message: 'OSPE not found' });
    const access = await canAccessModule(req.user._id, ospe.module.toString());
    if (!access.allowed) return res.status(403).json({ message: 'Access denied' });
    const flatQuestions = getFlatQuestions(ospe);
    const answerList = (answers || []).map((a, i) => {
      const qIndex = a.questionIndex ?? i;
      const q = flatQuestions[qIndex];
      let correct = false;
      if (q) {
        const mcqTypes = ['picture_mcq', 'text_mcq', 'guess_until_correct'];
        if (mcqTypes.includes(q.type) && q.correctIndex != null) {
          correct = q.correctIndex === Number(a.selectedIndex);
        } else if (q.type === 'viva_written' && q.expectedAnswer) {
          correct = String((a.writtenAnswer || '').trim()).toLowerCase() === String(q.expectedAnswer).toLowerCase();
        }
      }
      return {
        questionIndex: qIndex,
        selectedIndex: a.selectedIndex,
        writtenAnswer: a.writtenAnswer,
        correct,
      };
    });
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
