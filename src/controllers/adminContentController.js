import { Program } from '../models/Program.js';
import { Year } from '../models/Year.js';
import { Module } from '../models/Module.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { Mcq } from '../models/Mcq.js';
import { OneShotLecture } from '../models/OneShotLecture.js';
import { TopicResource } from '../models/TopicResource.js';
import { Ospe } from '../models/Ospe.js';
import { ProffStructure } from '../models/ProffStructure.js';
import { ProffMcq } from '../models/ProffMcq.js';
import { ProffOspe } from '../models/ProffOspe.js';
import { Package } from '../models/Package.js';
import { PromoCode } from '../models/PromoCode.js';
import { User } from '../models/User.js';
import { UserPackage } from '../models/UserPackage.js';
import { Payment } from '../models/Payment.js';
import { parseBulkMcqs } from '../utils/mcqGeminiParser.js';
import { getGeminiUsage as getGeminiUsageFromStore } from '../utils/geminiUsageStore.js';
import { getEaseGPTUsage } from '../utils/easegptUsageStore.js';
import { getOpenAIUsage } from '../utils/openaiUsageStore.js';
import { GeminiUsageLog } from '../models/GeminiUsageLog.js';

// Programs (with years and modules count)
export const listPrograms = async (req, res, next) => {
  try {
    const programs = await Program.aggregate([
      { $match: { deleted: { $ne: true } } },
      { $sort: { createdAt: 1 } },
      {
        $lookup: { from: 'years', localField: '_id', foreignField: 'program', as: 'years' },
      },
      { $addFields: { yearsCount: { $size: '$years' } } },
      {
        $lookup: {
          from: 'modules',
          let: { yearIds: '$years._id' },
          pipeline: [{ $match: { $expr: { $in: ['$year', '$$yearIds'] } } }, { $count: 'c' }],
          as: 'modCount',
        },
      },
      {
        $addFields: {
          modulesCount: {
            $ifNull: [{ $getField: { field: 'c', input: { $arrayElemAt: ['$modCount', 0] } } }, 0],
          },
        },
      },
      { $project: { years: 0, modCount: 0 } },
    ]);
    res.json(programs);
  } catch (err) {
    next(err);
  }
};
export const createProgram = async (req, res, next) => {
  try {
    const program = await Program.create(req.body);
    res.status(201).json(program);
  } catch (err) {
    next(err);
  }
};
export const updateProgram = async (req, res, next) => {
  try {
    const program = await Program.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!program) return res.status(404).json({ message: 'Program not found' });
    res.json(program);
  } catch (err) {
    next(err);
  }
};
const softDeleteSet = { $set: { deleted: true, deletedAt: new Date() } };

export const deleteProgram = async (req, res, next) => {
  try {
    const program = await Program.findByIdAndUpdate(req.params.id, softDeleteSet, { new: true });
    if (!program) return res.status(404).json({ message: 'Program not found' });
    await Year.updateMany({ program: req.params.id }, { $unset: { program: 1 } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// Years (with modulesCount when listing all)
export const listYears = async (req, res, next) => {
  try {
    const filter = req.query.programId ? { program: req.query.programId } : {};
    const useAggregation = !req.query.programId;
    if (useAggregation) {
      const years = await Year.aggregate([
        { $match: { ...(Object.keys(filter).length ? filter : {}), deleted: { $ne: true } } },
        { $sort: { createdAt: 1 } },
        { $lookup: { from: 'modules', localField: '_id', foreignField: 'year', as: 'modules' } },
        { $addFields: { modulesCount: { $size: '$modules' } } },
        { $project: { modules: 0 } },
        { $lookup: { from: 'programs', localField: 'program', foreignField: '_id', as: 'programDoc' } },
        { $unwind: { path: '$programDoc', preserveNullAndEmptyArrays: true } },
        { $addFields: { program: '$programDoc' } },
        { $project: { programDoc: 0 } },
      ]);
      return res.json(years);
    }
    const years = await Year.find(filter).sort({ createdAt: 1 }).populate('program', 'name').lean();
    res.json(years);
  } catch (err) {
    next(err);
  }
};
export const createYear = async (req, res, next) => {
  try {
    const year = await Year.create(req.body);
    res.status(201).json(year);
  } catch (err) {
    next(err);
  }
};
export const updateYear = async (req, res, next) => {
  try {
    const year = await Year.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!year) return res.status(404).json({ message: 'Year not found' });
    res.json(year);
  } catch (err) {
    next(err);
  }
};
export const deleteYear = async (req, res, next) => {
  try {
    const year = await Year.findByIdAndUpdate(req.params.id, softDeleteSet, { new: true });
    if (!year) return res.status(404).json({ message: 'Year not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// Modules
export const listModules = async (req, res, next) => {
  try {
    const modules = await Module.find({ year: req.params.yearId }).sort({ createdAt: 1 });
    res.json(modules);
  } catch (err) {
    next(err);
  }
};
export const createModule = async (req, res, next) => {
  try {
    const mod = await Module.create({ ...req.body, year: req.params.yearId });
    res.status(201).json(mod);
  } catch (err) {
    next(err);
  }
};
export const updateModule = async (req, res, next) => {
  try {
    const mod = await Module.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!mod) return res.status(404).json({ message: 'Module not found' });
    res.json(mod);
  } catch (err) {
    next(err);
  }
};
export const deleteModule = async (req, res, next) => {
  try {
    const mod = await Module.findByIdAndUpdate(req.params.id, softDeleteSet, { new: true });
    if (!mod) return res.status(404).json({ message: 'Module not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
export const listAllModules = async (req, res, next) => {
  try {
    const modules = await Module.find()
      .sort({ createdAt: 1 })
      .populate('year', 'name')
      .populate('subjectIds', 'name')
      .lean();
    res.json(modules);
  } catch (err) {
    next(err);
  }
};

// Subjects
export const listSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find({ module: req.params.moduleId }).sort({ createdAt: 1 });
    res.json(subjects);
  } catch (err) {
    next(err);
  }
};
export const createSubject = async (req, res, next) => {
  try {
    const { oneShotTitle, youtubeUrl, ...subjectBody } = req.body;
    const sub = await Subject.create({ ...subjectBody, module: req.params.moduleId });
    const mod = await Module.findById(req.params.moduleId);
    if (mod) {
      mod.subjectIds = mod.subjectIds || [];
      mod.subjectIds.push(sub._id);
      await mod.save();
    }
    const hasOneShot = [oneShotTitle, youtubeUrl].every((v) => v != null && String(v).trim() !== '');
    if (hasOneShot) {
      await OneShotLecture.create({
        subject: sub._id,
        title: String(oneShotTitle).trim(),
        youtubeUrl: String(youtubeUrl).trim(),
      });
    }
    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
};
export const updateSubject = async (req, res, next) => {
  try {
    const { oneShotTitle, youtubeUrl, ...subjectBody } = req.body;
    const sub = await Subject.findByIdAndUpdate(req.params.id, subjectBody, { new: true });
    if (!sub) return res.status(404).json({ message: 'Subject not found' });
    if (oneShotTitle != null || youtubeUrl != null) {
      const title = String(oneShotTitle ?? '').trim() || 'One Shot Lecture';
      const url = String(youtubeUrl ?? '').trim();
      const existing = await OneShotLecture.findOne({ subject: sub._id });
      if (existing) {
        await OneShotLecture.findByIdAndUpdate(existing._id, {
          title: title || existing.title,
          youtubeUrl: url || existing.youtubeUrl,
        });
      } else if (url) {
        await OneShotLecture.create({
          subject: sub._id,
          title,
          youtubeUrl: url,
        });
      }
    }
    res.json(sub);
  } catch (err) {
    next(err);
  }
};
export const deleteSubject = async (req, res, next) => {
  try {
    const sub = await Subject.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Subject not found' });
    await OneShotLecture.updateMany({ subject: sub._id }, softDeleteSet);
    await Subject.findByIdAndUpdate(req.params.id, softDeleteSet, { new: true });
    await Module.updateOne({ _id: sub.module }, { $pull: { subjectIds: sub._id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
export const listAllSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find()
      .sort({ createdAt: 1 })
      .populate({ path: 'module', select: 'name year', populate: { path: 'year', select: 'name _id' } });
    res.json(subjects);
  } catch (err) {
    next(err);
  }
};

// Topics
export const listTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find({ subject: req.params.subjectId }).sort({ createdAt: 1 });
    res.json(topics);
  } catch (err) {
    next(err);
  }
};
export const createTopic = async (req, res, next) => {
  try {
    const topic = await Topic.create({ ...req.body, subject: req.params.subjectId });
    const sub = await Subject.findById(req.params.subjectId);
    if (sub) {
      sub.topicIds = sub.topicIds || [];
      sub.topicIds.push(topic._id);
      await sub.save();
    }
    res.status(201).json(topic);
  } catch (err) {
    next(err);
  }
};
export const updateTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    res.json(topic);
  } catch (err) {
    next(err);
  }
};
export const deleteTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    await Mcq.updateMany({ topic: topic._id }, softDeleteSet);
    await TopicResource.updateMany({ topic: topic._id }, softDeleteSet);
    await Topic.findByIdAndUpdate(req.params.id, softDeleteSet, { new: true });
    await Subject.updateOne({ _id: topic.subject }, { $pull: { topicIds: topic._id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
export const listAllTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find()
      .sort({ createdAt: 1 })
      .populate({ path: 'subject', select: 'name module', populate: { path: 'module', select: 'name year', populate: { path: 'year', select: 'name _id' } } })
      .lean();
    const topicIds = topics.map((t) => t._id);
    const counts =
      topicIds.length > 0
        ? await Mcq.aggregate([{ $match: { topic: { $in: topicIds }, deleted: { $ne: true } } }, { $group: { _id: '$topic', count: { $sum: 1 } } }])
        : [];
    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
    topics.forEach((t) => (t.mcqCount = countMap[t._id.toString()] ?? 0));
    res.json(topics);
  } catch (err) {
    next(err);
  }
};

// MCQs
export const listMcqs = async (req, res, next) => {
  try {
    const mcqs = await Mcq.find({ topic: req.params.topicId }).sort({ createdAt: 1 });
    res.json(mcqs);
  } catch (err) {
    next(err);
  }
};
export const getMcq = async (req, res, next) => {
  try {
    const mcq = await Mcq.findOne({ _id: req.params.mcqId, topic: req.params.topicId });
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.json(mcq);
  } catch (err) {
    next(err);
  }
};
export const createMcq = async (req, res, next) => {
  try {
    const mcq = await Mcq.create({ ...req.body, topic: req.params.topicId });
    res.status(201).json(mcq);
  } catch (err) {
    next(err);
  }
};
export const updateMcq = async (req, res, next) => {
  try {
    const mcq = await Mcq.findByIdAndUpdate(req.params.mcqId, req.body, { new: true });
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.json(mcq);
  } catch (err) {
    next(err);
  }
};
export const deleteMcq = async (req, res, next) => {
  try {
    const mcq = await Mcq.findByIdAndUpdate(req.params.mcqId, softDeleteSet, { new: true });
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
export const parseBulkMcqsPreview = async (req, res, next) => {
  try {
    const rawText = req.body.text || req.body.raw || '';
    let mcqs, errors, partialBlockIndices, source, usage;
    try {
      ({ mcqs, errors, partialBlockIndices, source, usage } = await parseBulkMcqs(rawText));
    } catch (err) {
      if (err.isGeminiExhausted) {
        return res.status(429).json({ message: err.message, resetAt: err.resetAt });
      }
      if (err.isGeminiMissing) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
    console.log(`[Bulk MCQ preview] Parser: ${source || 'unknown'}, MCQs: ${mcqs?.length ?? 0}, Errors: ${errors?.length ?? 0}${usage ? `, Tokens: ${usage.totalTokenCount ?? '?'}` : ''}`);
    res.json({ mcqs, errors, partialBlockIndices: partialBlockIndices || [], source: source || null, usage: usage || null });
  } catch (err) {
    next(err);
  }
};
export const bulkCreateMcqs = async (req, res, next) => {
  try {
    // Support two modes:
    // 1) Client provides parsed MCQs in req.body.mcqs => use them directly (no parsing / OpenAI call)
    // 2) Fallback: parse raw text in req.body.text (legacy)
    const providedMcqs = Array.isArray(req.body.mcqs) ? req.body.mcqs : null;
    let mcqs, errors, partialBlockIndices, source, usage;
    if (providedMcqs) {
      mcqs = providedMcqs;
      errors = [];
      partialBlockIndices = [];
      source = 'client';
      usage = null;
    } else {
      const rawText = req.body.text || req.body.raw || '';
      try {
        ({ mcqs, errors, partialBlockIndices, source, usage } = await parseBulkMcqs(rawText));
      } catch (err) {
        if (err.isGeminiExhausted) {
          return res.status(429).json({ message: err.message, resetAt: err.resetAt });
        }
        if (err.isGeminiMissing) {
          return res.status(400).json({ message: err.message });
        }
        throw err;
      }
    }
    console.log(`[Bulk MCQ import] Parser: ${source || 'unknown'}, Creating ${mcqs?.length ?? 0} MCQs${usage ? `, Tokens: ${usage.totalTokenCount ?? '?'}` : ''}`);
    const created = [];
    for (let i = 0; i < mcqs.length; i++) {
      const m = mcqs[i];
      const doc = await Mcq.create({
        topic: req.params.topicId,
        question: m.question,
        options: m.options,
        correctIndex: m.correctIndex,
        explanation: m.explanation || '',
        type: req.body.type || 'text',
      });
      created.push(doc);
    }
    res.status(201).json({ created: created.length, errors, partialBlockIndices: partialBlockIndices || [], mcqs: created, source: source || null, usage: usage || null });
  } catch (err) {
    next(err);
  }
};

// One Shot Lectures (YouTube lectures per subject)
export const listOneShotLectures = async (req, res, next) => {
  try {
    const lectures = await OneShotLecture.find({ subject: req.params.subjectId }).sort({ createdAt: 1 });
    res.json(lectures);
  } catch (err) {
    next(err);
  }
};
export const createOneShotLecture = async (req, res, next) => {
  try {
    const lecture = await OneShotLecture.create({ ...req.body, subject: req.params.subjectId });
    res.status(201).json(lecture);
  } catch (err) {
    next(err);
  }
};
export const updateOneShotLecture = async (req, res, next) => {
  try {
    const lecture = await OneShotLecture.findOneAndUpdate(
      { _id: req.params.lectureId, subject: req.params.subjectId },
      req.body,
      { new: true }
    );
    if (!lecture) return res.status(404).json({ message: 'One shot lecture not found' });
    res.json(lecture);
  } catch (err) {
    next(err);
  }
};
export const deleteOneShotLecture = async (req, res, next) => {
  try {
    const lecture = await OneShotLecture.findOneAndUpdate(
      { _id: req.params.lectureId, subject: req.params.subjectId },
      softDeleteSet,
      { new: true }
    );
    if (!lecture) return res.status(404).json({ message: 'One shot lecture not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// Topic Resources (PDF upload + link)
export const listTopicResources = async (req, res, next) => {
  try {
    const resources = await TopicResource.find({ topic: req.params.topicId }).sort({ createdAt: 1 });
    res.json(resources);
  } catch (err) {
    next(err);
  }
};
export const createTopicResource = async (req, res, next) => {
  try {
    const { type, title, url: bodyUrl } = req.body || {};
    if (!type || !title) return res.status(400).json({ message: 'type and title required' });
    if (type !== 'pdf' && type !== 'link') return res.status(400).json({ message: 'type must be pdf or link' });

    let url = bodyUrl && bodyUrl.trim();
    if (type === 'pdf' && req.file?.buffer) {
      const { uploadRawToCloudinary } = await import('../config/cloudinary.js');
      const result = await uploadRawToCloudinary(req.file.buffer, 'medease/topic-resources');
      url = result.secure_url;
    }
    if (!url) return res.status(400).json({ message: type === 'pdf' ? 'PDF file or url required' : 'url required for link' });

    const resource = await TopicResource.create({
      topic: req.params.topicId,
      type,
      title: title.trim(),
      url,
    });
    res.status(201).json(resource);
  } catch (err) {
    next(err);
  }
};
export const updateTopicResource = async (req, res, next) => {
  try {
    const resource = await TopicResource.findOne({ _id: req.params.resourceId, topic: req.params.topicId });
    if (!resource) return res.status(404).json({ message: 'Topic resource not found' });
    const { title, url } = req.body || {};
    if (title != null) resource.title = title.trim();
    if (url != null) resource.url = url.trim();
    await resource.save();
    res.json(resource);
  } catch (err) {
    next(err);
  }
};
export const deleteTopicResource = async (req, res, next) => {
  try {
    const resource = await TopicResource.findOneAndUpdate(
      { _id: req.params.resourceId, topic: req.params.topicId },
      softDeleteSet,
      { new: true }
    );
    if (!resource) return res.status(404).json({ message: 'Topic resource not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// OSPEs
export const listOspes = async (req, res, next) => {
  try {
    const ospes = await Ospe.find({ module: req.params.moduleId }).sort({ createdAt: 1 });
    res.json(ospes);
  } catch (err) {
    next(err);
  }
};
export const createOspe = async (req, res, next) => {
  try {
    const ospe = await Ospe.create({ ...req.body, module: req.params.moduleId });
    res.status(201).json(ospe);
  } catch (err) {
    next(err);
  }
};
export const updateOspe = async (req, res, next) => {
  try {
    const ospe = await Ospe.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ospe) return res.status(404).json({ message: 'OSPE not found' });
    res.json(ospe);
  } catch (err) {
    next(err);
  }
};
export const deleteOspe = async (req, res, next) => {
  try {
    const ospe = await Ospe.findByIdAndUpdate(req.params.id, softDeleteSet, { new: true });
    if (!ospe) return res.status(404).json({ message: 'OSPE not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// Proff
export const listProff = async (req, res, next) => {
  try {
    const list = await ProffStructure.find();
    res.json(list);
  } catch (err) {
    next(err);
  }
};
export const upsertProff = async (req, res, next) => {
  try {
    const { university, years } = req.body;
    const doc = await ProffStructure.findOneAndUpdate(
      { university },
      { university, years: years || [] },
      { new: true, upsert: true }
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

const DEFAULT_JSMU_PAPERS = [
  { name: 'Paper 1 (Mix MCQs)', type: 'mcq' },
  { name: 'Paper 2 (Mix MCQs)', type: 'mcq' },
  { name: 'OSPE 1', type: 'ospe' },
  { name: 'OSPE 2', type: 'ospe' },
];

export const getProffJsmu = async (req, res, next) => {
  try {
    const doc = await ProffStructure.findOne({ university: 'jsmu' });
    if (!doc) return res.status(404).json({ message: 'JSMU structure not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

export const createProffJsmuYear = async (req, res, next) => {
  try {
    let doc = await ProffStructure.findOne({ university: 'jsmu' });
    if (!doc) doc = await ProffStructure.create({ university: 'jsmu', years: [] });
    const { name, papers } = req.body;
    const yearName = name || `Year ${(doc.years?.length ?? 0) + 1}`;
    const yearPapers = Array.isArray(papers) && papers.length > 0 ? papers : DEFAULT_JSMU_PAPERS;
    doc.years.push({ name: yearName, papers: yearPapers });
    await doc.save();
    const added = doc.years[doc.years.length - 1];
    res.status(201).json(added);
  } catch (err) {
    next(err);
  }
};

export const updateProffJsmuYear = async (req, res, next) => {
  try {
    const doc = await ProffStructure.findOne({ university: 'jsmu' });
    if (!doc) return res.status(404).json({ message: 'JSMU structure not found' });
    const year = doc.years.id(req.params.yearId);
    if (!year) return res.status(404).json({ message: 'Year not found' });
    const { name, papers } = req.body;
    if (name !== undefined) year.name = name;
    if (papers !== undefined) year.papers = papers;
    await doc.save();
    res.json(year);
  } catch (err) {
    next(err);
  }
};

export const deleteProffJsmuYear = async (req, res, next) => {
  try {
    const doc = await ProffStructure.findOne({ university: 'jsmu' });
    if (!doc) return res.status(404).json({ message: 'JSMU structure not found' });
    const year = doc.years.id(req.params.yearId);
    if (!year) return res.status(404).json({ message: 'Year not found' });
    doc.years.pull(req.params.yearId);
    await doc.save();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// Proff Other University
export const getProffOther = async (req, res, next) => {
  try {
    const doc = await ProffStructure.findOne({ university: 'other' });
    if (!doc) return res.status(404).json({ message: 'Other university structure not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

export const createProffOtherYear = async (req, res, next) => {
  try {
    let doc = await ProffStructure.findOne({ university: 'other' });
    if (!doc) doc = await ProffStructure.create({ university: 'other', years: [] });
    const { name, subjects } = req.body;
    const yearName = name || `Year ${(doc.years?.length ?? 0) + 1}`;
    doc.years.push({ name: yearName, subjects: Array.isArray(subjects) ? subjects : [] });
    await doc.save();
    const added = doc.years[doc.years.length - 1];
    res.status(201).json(added);
  } catch (err) {
    next(err);
  }
};

export const updateProffOtherYear = async (req, res, next) => {
  try {
    const doc = await ProffStructure.findOne({ university: 'other' });
    if (!doc) return res.status(404).json({ message: 'Other university structure not found' });
    const year = doc.years.id(req.params.yearId);
    if (!year) return res.status(404).json({ message: 'Year not found' });
    const { name, subjects } = req.body;
    if (name !== undefined) year.name = name;
    if (subjects !== undefined) year.subjects = subjects;
    await doc.save();
    res.json(year);
  } catch (err) {
    next(err);
  }
};

export const deleteProffOtherYear = async (req, res, next) => {
  try {
    const doc = await ProffStructure.findOne({ university: 'other' });
    if (!doc) return res.status(404).json({ message: 'Other university structure not found' });
    const year = doc.years.id(req.params.yearId);
    if (!year) return res.status(404).json({ message: 'Year not found' });
    doc.years.pull(req.params.yearId);
    await doc.save();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// --- Proff content (MCQs, OSPE) ---
async function getJsmuYearAndPaper(yearId, paperId) {
  const doc = await ProffStructure.findOne({ university: 'jsmu' });
  if (!doc) return { doc: null, year: null, paper: null };
  const year = doc.years.id(yearId);
  if (!year) return { doc, year: null, paper: null };
  const paper = year.papers?.id?.(paperId) ?? null;
  return { doc, year, paper };
}
async function getOtherYearAndSubject(yearId, subjectId) {
  const doc = await ProffStructure.findOne({ university: 'other' });
  if (!doc) return { doc: null, year: null, subject: null };
  const year = doc.years.id(yearId);
  if (!year) return { doc, year: null, subject: null };
  const subject = year.subjects?.id?.(subjectId) ?? null;
  return { doc, year, subject };
}

// JSMU paper MCQs
export const listProffJsmuPaperMcqs = async (req, res, next) => {
  try {
    const { year, paper } = await getJsmuYearAndPaper(req.params.yearId, req.params.paperId);
    if (!year || !paper) return res.status(404).json({ message: 'Year or paper not found' });
    if (paper.type !== 'mcq') return res.status(400).json({ message: 'Paper is not an MCQ paper' });
    const mcqs = await ProffMcq.find({
      university: 'jsmu',
      proffYear: req.params.yearId,
      proffPaper: req.params.paperId,
    }).sort({ createdAt: 1 });
    res.json(mcqs);
  } catch (err) {
    next(err);
  }
};
export const getProffJsmuPaperMcq = async (req, res, next) => {
  try {
    const { year, paper } = await getJsmuYearAndPaper(req.params.yearId, req.params.paperId);
    if (!year || !paper) return res.status(404).json({ message: 'Year or paper not found' });
    const mcq = await ProffMcq.findOne({
      _id: req.params.mcqId,
      university: 'jsmu',
      proffYear: req.params.yearId,
      proffPaper: req.params.paperId,
    });
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.json(mcq);
  } catch (err) {
    next(err);
  }
};
export const createProffJsmuPaperMcq = async (req, res, next) => {
  try {
    const { year, paper } = await getJsmuYearAndPaper(req.params.yearId, req.params.paperId);
    if (!year || !paper) return res.status(404).json({ message: 'Year or paper not found' });
    if (paper.type !== 'mcq') return res.status(400).json({ message: 'Paper is not an MCQ paper' });
    const mcq = await ProffMcq.create({
      ...req.body,
      university: 'jsmu',
      proffYear: req.params.yearId,
      proffPaper: req.params.paperId,
    });
    res.status(201).json(mcq);
  } catch (err) {
    next(err);
  }
};
export const updateProffJsmuPaperMcq = async (req, res, next) => {
  try {
    const mcq = await ProffMcq.findOneAndUpdate(
      {
        _id: req.params.mcqId,
        university: 'jsmu',
        proffYear: req.params.yearId,
        proffPaper: req.params.paperId,
      },
      req.body,
      { new: true }
    );
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.json(mcq);
  } catch (err) {
    next(err);
  }
};
export const deleteProffJsmuPaperMcq = async (req, res, next) => {
  try {
    const mcq = await ProffMcq.findOneAndUpdate(
      {
        _id: req.params.mcqId,
        university: 'jsmu',
        proffYear: req.params.yearId,
        proffPaper: req.params.paperId,
      },
      softDeleteSet,
      { new: true }
    );
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
export const parseProffJsmuPaperMcqs = async (req, res, next) => {
  try {
    const { year, paper } = await getJsmuYearAndPaper(req.params.yearId, req.params.paperId);
    if (!year || !paper) return res.status(404).json({ message: 'Year or paper not found' });
    if (paper.type !== 'mcq') return res.status(400).json({ message: 'Paper is not an MCQ paper' });
    const rawText = req.body.text || req.body.raw || '';
    let mcqs, errors, partialBlockIndices, source, usage;
    try {
      ({ mcqs, errors, partialBlockIndices, source, usage } = await parseBulkMcqs(rawText));
    } catch (err) {
      if (err.isGeminiExhausted) {
        return res.status(429).json({ message: err.message, resetAt: err.resetAt });
      }
      if (err.isGeminiMissing) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
    res.json({ mcqs, errors, partialBlockIndices: partialBlockIndices || [], source, usage: usage || null });
  } catch (err) {
    next(err);
  }
};
export const bulkCreateProffJsmuPaperMcqs = async (req, res, next) => {
  try {
    const { year, paper } = await getJsmuYearAndPaper(req.params.yearId, req.params.paperId);
    if (!year || !paper) return res.status(404).json({ message: 'Year or paper not found' });
    if (paper.type !== 'mcq') return res.status(400).json({ message: 'Paper is not an MCQ paper' });
    const rawText = req.body.text || req.body.raw || '';
    let mcqs, errors, partialBlockIndices, source, usage;
    try {
      ({ mcqs, errors, partialBlockIndices, source, usage } = await parseBulkMcqs(rawText));
    } catch (err) {
      if (err.isGeminiExhausted) {
        return res.status(429).json({ message: err.message, resetAt: err.resetAt });
      }
      if (err.isGeminiMissing) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
    console.log(`[Bulk Proff JSMU MCQ import] Parser: ${source || 'unknown'}, Creating ${mcqs?.length ?? 0} MCQs${usage ? `, Tokens: ${usage.totalTokenCount ?? '?'}` : ''}`);
    const created = [];
    for (let i = 0; i < mcqs.length; i++) {
      const m = mcqs[i];
      const doc = await ProffMcq.create({
        university: 'jsmu',
        proffYear: req.params.yearId,
        proffPaper: req.params.paperId,
        question: m.question,
        options: m.options?.length ? m.options : ['Option 1', 'Option 2'],
        correctIndex: m.correctIndex ?? 0,
        explanation: m.explanation || '',
        type: req.body.type || 'text',
      });
      created.push(doc);
    }
    res.status(201).json({ created: created.length, errors, partialBlockIndices: partialBlockIndices || [], mcqs: created, source: source || null, usage: usage || null });
  } catch (err) {
    next(err);
  }
};

// JSMU paper OSPE
export const getProffJsmuPaperOspe = async (req, res, next) => {
  try {
    const { year, paper } = await getJsmuYearAndPaper(req.params.yearId, req.params.paperId);
    if (!year || !paper) return res.status(404).json({ message: 'Year or paper not found' });
    if (paper.type !== 'ospe') return res.status(400).json({ message: 'Paper is not an OSPE paper' });
    const ospe = await ProffOspe.findOne({
      university: 'jsmu',
      proffYear: req.params.yearId,
      proffPaper: req.params.paperId,
    });
    if (!ospe) return res.status(404).json({ message: 'OSPE not found' });
    res.json(ospe);
  } catch (err) {
    next(err);
  }
};
export const upsertProffJsmuPaperOspe = async (req, res, next) => {
  try {
    const { year, paper } = await getJsmuYearAndPaper(req.params.yearId, req.params.paperId);
    if (!year || !paper) return res.status(404).json({ message: 'Year or paper not found' });
    if (paper.type !== 'ospe') return res.status(400).json({ message: 'Paper is not an OSPE paper' });
    const ospe = await ProffOspe.findOneAndUpdate(
      {
        university: 'jsmu',
        proffYear: req.params.yearId,
        proffPaper: req.params.paperId,
      },
      { ...req.body, university: 'jsmu', proffYear: req.params.yearId, proffPaper: req.params.paperId },
      { new: true, upsert: true }
    );
    res.json(ospe);
  } catch (err) {
    next(err);
  }
};

// Other subject MCQs
export const listProffOtherSubjectMcqs = async (req, res, next) => {
  try {
    const { year, subject } = await getOtherYearAndSubject(req.params.yearId, req.params.subjectId);
    if (!year || !subject) return res.status(404).json({ message: 'Year or subject not found' });
    const mcqs = await ProffMcq.find({
      university: 'other',
      proffYear: req.params.yearId,
      proffSubject: req.params.subjectId,
    }).sort({ createdAt: 1 });
    res.json(mcqs);
  } catch (err) {
    next(err);
  }
};
export const getProffOtherSubjectMcq = async (req, res, next) => {
  try {
    const mcq = await ProffMcq.findOne({
      _id: req.params.mcqId,
      university: 'other',
      proffYear: req.params.yearId,
      proffSubject: req.params.subjectId,
    });
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.json(mcq);
  } catch (err) {
    next(err);
  }
};
export const createProffOtherSubjectMcq = async (req, res, next) => {
  try {
    const { year, subject } = await getOtherYearAndSubject(req.params.yearId, req.params.subjectId);
    if (!year || !subject) return res.status(404).json({ message: 'Year or subject not found' });
    const mcq = await ProffMcq.create({
      ...req.body,
      university: 'other',
      proffYear: req.params.yearId,
      proffSubject: req.params.subjectId,
    });
    res.status(201).json(mcq);
  } catch (err) {
    next(err);
  }
};
export const updateProffOtherSubjectMcq = async (req, res, next) => {
  try {
    const mcq = await ProffMcq.findOneAndUpdate(
      {
        _id: req.params.mcqId,
        university: 'other',
        proffYear: req.params.yearId,
        proffSubject: req.params.subjectId,
      },
      req.body,
      { new: true }
    );
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.json(mcq);
  } catch (err) {
    next(err);
  }
};
export const deleteProffOtherSubjectMcq = async (req, res, next) => {
  try {
    const mcq = await ProffMcq.findOneAndUpdate(
      {
        _id: req.params.mcqId,
        university: 'other',
        proffYear: req.params.yearId,
        proffSubject: req.params.subjectId,
      },
      softDeleteSet,
      { new: true }
    );
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
export const parseProffOtherSubjectMcqs = async (req, res, next) => {
  try {
    const { year, subject } = await getOtherYearAndSubject(req.params.yearId, req.params.subjectId);
    if (!year || !subject) return res.status(404).json({ message: 'Year or subject not found' });
    const rawText = req.body.text || req.body.raw || '';
    let mcqs, errors, partialBlockIndices, source, usage;
    try {
      ({ mcqs, errors, partialBlockIndices, source, usage } = await parseBulkMcqs(rawText));
    } catch (err) {
      if (err.isGeminiExhausted) {
        return res.status(429).json({ message: err.message, resetAt: err.resetAt });
      }
      if (err.isGeminiMissing) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
    res.json({ mcqs, errors, partialBlockIndices: partialBlockIndices || [], source, usage: usage || null });
  } catch (err) {
    next(err);
  }
};
export const bulkCreateProffOtherSubjectMcqs = async (req, res, next) => {
  try {
    const { year, subject } = await getOtherYearAndSubject(req.params.yearId, req.params.subjectId);
    if (!year || !subject) return res.status(404).json({ message: 'Year or subject not found' });
    const rawText = req.body.text || req.body.raw || '';
    let mcqs, errors, partialBlockIndices, source, usage;
    try {
      ({ mcqs, errors, partialBlockIndices, source, usage } = await parseBulkMcqs(rawText));
    } catch (err) {
      if (err.isGeminiExhausted) {
        return res.status(429).json({ message: err.message, resetAt: err.resetAt });
      }
      if (err.isGeminiMissing) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
    console.log(`[Bulk Proff Other MCQ import] Parser: ${source || 'unknown'}, Creating ${mcqs?.length ?? 0} MCQs${usage ? `, Tokens: ${usage.totalTokenCount ?? '?'}` : ''}`);
    const created = [];
    for (let i = 0; i < mcqs.length; i++) {
      const m = mcqs[i];
      const doc = await ProffMcq.create({
        university: 'other',
        proffYear: req.params.yearId,
        proffSubject: req.params.subjectId,
        question: m.question,
        options: m.options?.length ? m.options : ['Option 1', 'Option 2'],
        correctIndex: m.correctIndex ?? 0,
        explanation: m.explanation || '',
        type: req.body.type || 'text',
      });
      created.push(doc);
    }
    res.status(201).json({ created: created.length, errors, partialBlockIndices: partialBlockIndices || [], mcqs: created, source: source || null, usage: usage || null });
  } catch (err) {
    next(err);
  }
};

// Other subject OSPE
export const getProffOtherSubjectOspe = async (req, res, next) => {
  try {
    const { year, subject } = await getOtherYearAndSubject(req.params.yearId, req.params.subjectId);
    if (!year || !subject) return res.status(404).json({ message: 'Year or subject not found' });
    const ospe = await ProffOspe.findOne({
      university: 'other',
      proffYear: req.params.yearId,
      proffSubject: req.params.subjectId,
    });
    if (!ospe) return res.status(404).json({ message: 'OSPE not found' });
    res.json(ospe);
  } catch (err) {
    next(err);
  }
};
export const upsertProffOtherSubjectOspe = async (req, res, next) => {
  try {
    const { year, subject } = await getOtherYearAndSubject(req.params.yearId, req.params.subjectId);
    if (!year || !subject) return res.status(404).json({ message: 'Year or subject not found' });
    const ospe = await ProffOspe.findOneAndUpdate(
      {
        university: 'other',
        proffYear: req.params.yearId,
        proffSubject: req.params.subjectId,
      },
      { ...req.body, university: 'other', proffYear: req.params.yearId, proffSubject: req.params.subjectId },
      { new: true, upsert: true }
    );
    res.json(ospe);
  } catch (err) {
    next(err);
  }
};

// Admin packages
export const listPackagesAdmin = async (req, res, next) => {
  try {
    const packages = await Package.find().sort({ year: 1, part: 1 }).populate('moduleIds');
    res.json(packages);
  } catch (err) {
    next(err);
  }
};
export const createPackage = async (req, res, next) => {
  try {
    const pkg = await Package.create(req.body);
    res.status(201).json(pkg);
  } catch (err) {
    next(err);
  }
};
export const updatePackage = async (req, res, next) => {
  try {
    const pkg = await Package.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    res.json(pkg);
  } catch (err) {
    next(err);
  }
};
export const deletePackage = async (req, res, next) => {
  try {
    const pkg = await Package.findByIdAndUpdate(req.params.id, softDeleteSet, { new: true });
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// Dashboard stats + recent users & payments (revenue/payment data only for superadmin)
export const dashboardStats = async (req, res, next) => {
  try {
    const notDeleted = { deleted: { $ne: true } };
    const isSuperAdmin = req.user?.role === 'superadmin';
    const [
      userCount,
      pendingPayments,
      programCount,
      yearCount,
      moduleCount,
      topicCount,
      mcqCount,
      recentUsers,
      recentPayments,
    ] = await Promise.all([
      User.countDocuments({ role: 'student', ...notDeleted }),
      isSuperAdmin ? Payment.countDocuments({ status: 'pending' }) : 0,
      Program.countDocuments(notDeleted),
      Year.countDocuments(notDeleted),
      Module.countDocuments(notDeleted),
      Topic.countDocuments(notDeleted),
      Mcq.countDocuments(notDeleted),
      User.find({ role: 'student' }).select('name email isVerified').sort({ createdAt: -1 }).limit(5).lean(),
      isSuperAdmin
        ? Payment.find()
            .populate('user', 'name email')
            .populate('package', 'name')
            .sort({ createdAt: -1 })
            .limit(8)
            .lean()
        : [],
    ]);
    res.json({
      userCount,
      pendingPayments: isSuperAdmin ? pendingPayments : 0,
      programCount,
      yearCount,
      moduleCount,
      topicCount,
      mcqCount,
      recentUsers,
      recentPayments: isSuperAdmin ? recentPayments : [],
    });
  } catch (err) {
    next(err);
  }
};

export const getGeminiUsage = async (req, res, next) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmin can view API usage' });
    }
    const result = getGeminiUsageFromStore();
    const easegpt = getEaseGPTUsage();
    const openai = getOpenAIUsage();
    res.json({ ...result, easegpt, openai });
  } catch (err) {
    next(err);
  }
};

export const getGeminiUsageLogs = async (req, res, next) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmin can view API usage logs' });
    }
    const dateStr = String(req.query.date || '').trim();
    const now = new Date();
    let year, month, day;
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      [year, month, day] = dateStr.split('-').map((n) => Number(n));
    } else {
      year = now.getUTCFullYear();
      month = now.getUTCMonth() + 1;
      day = now.getUTCDate();
    }
    const dayStart = Date.UTC(year, month - 1, day);
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    // Pagination params
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit || '200', 10) || 200));

    const filter = { timestamp: { $gte: new Date(dayStart), $lt: new Date(dayEnd) } };

    const totalEntries = await GeminiUsageLog.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalEntries / limit));

    // Return most recent first
    const entries = await GeminiUsageLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean();

    // Summary aggregation across the whole day (not just the page)
    const agg = await GeminiUsageLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$keyIndex',
          requests: { $sum: 1 },
          tokens: { $sum: { $ifNull: ['$tokens', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Per-minute (last 60s) aggregation for RPM/TPM
    const minuteStart = new Date(Date.now() - 60 * 1000);
    const minuteAgg = await GeminiUsageLog.aggregate([
      { $match: { timestamp: { $gte: minuteStart, $lt: new Date(dayEnd) } } },
      {
        $group: {
          _id: '$keyIndex',
          rpm: { $sum: 1 },
          tpm: { $sum: { $ifNull: ['$tokens', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const minuteMap = Object.fromEntries(minuteAgg.map((a) => [a._id, { rpm: a.rpm || 0, tpm: a.tpm || 0 }]));

    const RPM_LIMIT = 10;
    const TPM_LIMIT = 250000;
    const RPD_LIMIT = 20;

    const keys = agg.map((a) => {
      const ki = a._id;
      const requests = a.requests || 0;
      const tokens = a.tokens || 0;
      const { rpm = 0, tpm = 0 } = minuteMap[ki] || {};
      const exhaustedReasons = [];
      if (rpm >= RPM_LIMIT) exhaustedReasons.push('RPM');
      if (tpm >= TPM_LIMIT) exhaustedReasons.push('TPM');
      if (requests >= RPD_LIMIT) exhaustedReasons.push('RPD');
      return {
        keyIndex: ki,
        label: `Key ${ki + 1}`,
        rpm,
        tpm,
        rpd: requests,
        tokens,
        limits: { rpm: RPM_LIMIT, tpm: TPM_LIMIT, rpd: RPD_LIMIT },
        exhausted: exhaustedReasons.length > 0,
        exhaustedReasons,
      };
    });

    const totals = keys.reduce(
      (s, k) => {
        s.requests += k.rpd || 0;
        s.tokens += k.tokens || 0;
        return s;
      },
      { requests: 0, tokens: 0 }
    );

    const openai = getOpenAIUsage();
    res.json({
      date: new Date(dayStart).toISOString().slice(0, 10),
      page,
      limit,
      totalEntries,
      totalPages,
      entries: entries.map((e) => ({
        timestamp: e.timestamp ? e.timestamp.toISOString() : new Date(e.timestamp).toISOString(),
        keyIndex: e.keyIndex,
        tokens: e.tokens || 0,
        meta: e.meta || {},
      })),
      summary: { keys, totals, openai },
    });
  } catch (err) {
    next(err);
  }
};

// Admin promo codes
export const listPromoCodes = async (req, res, next) => {
  try {
    const codes = await PromoCode.find().sort({ createdAt: -1 });
    res.json(codes);
  } catch (err) {
    next(err);
  }
};
export const createPromoCode = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.code) data.code = data.code.trim().toUpperCase();
    const promo = await PromoCode.create(data);
    res.status(201).json(promo);
  } catch (err) {
    next(err);
  }
};
export const updatePromoCode = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.code) data.code = data.code.trim().toUpperCase();
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!promo) return res.status(404).json({ message: 'Promo code not found' });
    res.json(promo);
  } catch (err) {
    next(err);
  }
};
export const deletePromoCode = async (req, res, next) => {
  try {
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, softDeleteSet, { new: true });
    if (!promo) return res.status(404).json({ message: 'Promo code not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

/** One-time admin action: assign all free-trial style packages to all student users. */
export const activateFreeTrialForAllUsers = async (req, res, next) => {
  try {
    const freePkgs = await Package.find({
      $or: [
        { name: /free[-\s]?trial/i },
        { planKey: 'free-trial' },
        { type: /free/i },
      ],
    }).lean();

    if (!freePkgs || freePkgs.length === 0) {
      return res.status(400).json({ message: 'No free-trial style packages found' });
    }

    // Only target students who have not filled academicDetails yet
    const students = await User.find({
      role: 'student',
      $or: [{ academicDetails: { $exists: false } }, { academicDetails: null }],
    })
      .select('_id email')
      .lean();
    let created = 0;
    const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    for (const su of students) {
      for (const pkg of freePkgs) {
        // eslint-disable-next-line no-await-in-loop
        const alreadyActive = await UserPackage.exists({
          user: su._id,
          package: pkg._id,
          status: 'active',
        });
        if (alreadyActive) continue;

        // eslint-disable-next-line no-await-in-loop
        await UserPackage.create({
          user: su._id,
          package: pkg._id,
          status: 'active',
          approvedAt: new Date(),
          expiresAt,
        });
        created += 1;
      }
    }

    return res.json({ message: 'Free-trial activation completed', created });
  } catch (err) {
    next(err);
  }
};

/** Remove 5th option from all MCQs that have more than 4 options (fix "Correct Answer: C" stored as option E). */
export const removeFifthOptionFromMcqs = async (req, res, next) => {
  try {
    const mcqsWithFiveOrMore = await Mcq.find({
      $expr: { $gt: [{ $size: '$options' }, 4] },
    }).lean();

    const total = mcqsWithFiveOrMore.length;
    if (total === 0) {
      return res.json({
        message: 'No MCQs found with more than 4 options.',
        updated: 0,
        correctedIndex: 0,
      });
    }

    let correctedIndex = 0;
    for (const doc of mcqsWithFiveOrMore) {
      const options = Array.isArray(doc.options) ? doc.options.slice(0, 4) : [];
      let correctIndex = doc.correctIndex;
      if (correctIndex >= 4) {
        correctIndex = 3;
        correctedIndex += 1;
      }
      await Mcq.updateOne({ _id: doc._id }, { $set: { options, correctIndex } });
    }

    res.json({
      message: `Removed 5th option from ${total} MCQ(s).`,
      updated: total,
      correctedIndex,
    });
  } catch (err) {
    next(err);
  }
};

// ——— Super admin only: list admins, create admin, reset password ———
export const listAdmins = async (req, res, next) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const admins = await User.find({ role: { $in: ['admin', 'superadmin'] }, deleted: { $ne: true } })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    res.json(admins);
  } catch (err) {
    next(err);
  }
};

export const createAdminUser = async (req, res, next) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { name, email, password } = req.body;
    if (!email || !password || String(password).length < 6) {
      return res.status(400).json({ message: 'Email and password (min 6 characters) required' });
    }
    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const user = await User.create({
      name: (name || email.split('@')[0] || 'Admin').trim(),
      email: String(email).toLowerCase().trim(),
      password: String(password),
      role: 'admin',
      isVerified: true,
    });
    const u = await User.findById(user._id).select('-password').lean();
    res.status(201).json(u);
  } catch (err) {
    next(err);
  }
};

export const resetAdminPassword = async (req, res, next) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: 'newPassword required (min 6 characters)' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.role !== 'admin' && target.role !== 'superadmin') {
      return res.status(400).json({ message: 'Can only reset password for admins' });
    }
    target.password = String(newPassword);
    await target.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
};

// --- Duplication & Cloning Helpers ---

export const duplicateModule = async (req, res, next) => {
  try {
    const originalMod = await Module.findById(req.params.id).lean();
    if (!originalMod) return res.status(404).json({ message: 'Module not found' });

    // 1. Create new Module
    const newModData = {
      ...originalMod,
      _id: undefined,
      name: `${originalMod.name} (Copy)`,
      subjectIds: [],
      createdAt: undefined,
      updatedAt: undefined,
    };
    const newMod = await Module.create(newModData);

    // 2. Clone Subjects
    const subjects = await Subject.find({ module: originalMod._id, deleted: { $ne: true } }).lean();
    for (const sub of subjects) {
      const newSubData = {
        ...sub,
        _id: undefined,
        module: newMod._id,
        topicIds: [],
        createdAt: undefined,
        updatedAt: undefined,
      };
      const newSub = await Subject.create(newSubData);
      
      // Add to module's subjectIds
      await Module.findByIdAndUpdate(newMod._id, { $push: { subjectIds: newSub._id } });

      // Clone OneShotLectures for this subject
      const lectures = await OneShotLecture.find({ subject: sub._id, deleted: { $ne: true } }).lean();
      for (const lec of lectures) {
        await OneShotLecture.create({ ...lec, _id: undefined, subject: newSub._id, createdAt: undefined, updatedAt: undefined });
      }

      // Clone Topics
      const topics = await Topic.find({ subject: sub._id, deleted: { $ne: true } }).lean();
      for (const top of topics) {
        const newTopData = {
          ...top,
          _id: undefined,
          subject: newSub._id,
          createdAt: undefined,
          updatedAt: undefined,
        };
        const newTop = await Topic.create(newTopData);
        
        // Add to subject's topicIds
        await Subject.findByIdAndUpdate(newSub._id, { $push: { topicIds: newTop._id } });

        // Clone MCQs
        const mcqs = await Mcq.find({ topic: top._id, deleted: { $ne: true } }).lean();
        if (mcqs.length > 0) {
          const newMcqs = mcqs.map(m => ({ ...m, _id: undefined, topic: newTop._id, createdAt: undefined, updatedAt: undefined }));
          await Mcq.insertMany(newMcqs);
        }

        // Clone Resources
        const resources = await TopicResource.find({ topic: top._id, deleted: { $ne: true } }).lean();
        for (const res of resources) {
          await TopicResource.create({ ...res, _id: undefined, topic: newTop._id, createdAt: undefined, updatedAt: undefined });
        }
      }
    }

    // 3. Clone OSPEs for this module
    const ospes = await Ospe.find({ module: originalMod._id, deleted: { $ne: true } }).lean();
    for (const ospe of ospes) {
      // Deep clone stripping subdocument IDs
      const stations = ospe.stations?.map(s => ({
        ...s,
        _id: undefined,
        questions: s.questions?.map(q => ({ ...q, _id: undefined }))
      })) || [];
      const questions = ospe.questions?.map(q => ({ ...q, _id: undefined })) || [];

      await Ospe.create({
        ...ospe,
        _id: undefined,
        module: newMod._id,
        createdAt: undefined,
        updatedAt: undefined,
        stations,
        questions,
      });
    }

    res.status(201).json(newMod);
  } catch (err) {
    next(err);
  }
};

export const copySubject = async (req, res, next) => {
  try {
    const { targetModuleId } = req.body;
    if (!targetModuleId) return res.status(400).json({ message: 'targetModuleId required' });

    const originalSub = await Subject.findById(req.params.id).lean();
    if (!originalSub) return res.status(404).json({ message: 'Subject not found' });

    const targetMod = await Module.findById(targetModuleId);
    if (!targetMod) return res.status(404).json({ message: 'Target module not found' });

    // 1. Create new Subject
    const newSubData = {
      ...originalSub,
      _id: undefined,
      module: targetMod._id,
      topicIds: [],
      createdAt: undefined,
      updatedAt: undefined,
    };
    const newSub = await Subject.create(newSubData);
    
    // Add to module's subjectIds
    targetMod.subjectIds = targetMod.subjectIds || [];
    targetMod.subjectIds.push(newSub._id);
    await targetMod.save();

    // 2. Clone OneShotLectures
    const lectures = await OneShotLecture.find({ subject: originalSub._id, deleted: { $ne: true } }).lean();
    for (const lec of lectures) {
      await OneShotLecture.create({ ...lec, _id: undefined, subject: newSub._id, createdAt: undefined, updatedAt: undefined });
    }

    // 3. Clone Topics
    const topics = await Topic.find({ subject: originalSub._id, deleted: { $ne: true } }).lean();
    for (const top of topics) {
      const newTopData = {
        ...top,
        _id: undefined,
        subject: newSub._id,
        createdAt: undefined,
        updatedAt: undefined,
      };
      const newTop = await Topic.create(newTopData);
      
      // Add to subject's topicIds
      await Subject.findByIdAndUpdate(newSub._id, { $push: { topicIds: newTop._id } });

      // Clone MCQs
      const mcqs = await Mcq.find({ topic: top._id, deleted: { $ne: true } }).lean();
      if (mcqs.length > 0) {
        const newMcqs = mcqs.map(m => ({ ...m, _id: undefined, topic: newTop._id, createdAt: undefined, updatedAt: undefined }));
        await Mcq.insertMany(newMcqs);
      }

      // Clone Resources
      const resources = await TopicResource.find({ topic: top._id, deleted: { $ne: true } }).lean();
      for (const res of resources) {
        await TopicResource.create({ ...res, _id: undefined, topic: newTop._id, createdAt: undefined, updatedAt: undefined });
      }
    }

    res.status(201).json(newSub);
  } catch (err) {
    next(err);
  }
};

export const copyTopic = async (req, res, next) => {
  try {
    const { targetSubjectId } = req.body;
    if (!targetSubjectId) return res.status(400).json({ message: 'targetSubjectId required' });

    const originalTop = await Topic.findById(req.params.id).lean();
    if (!originalTop) return res.status(404).json({ message: 'Topic not found' });

    const targetSub = await Subject.findById(targetSubjectId);
    if (!targetSub) return res.status(404).json({ message: 'Target subject not found' });

    // 1. Create new Topic
    const newTopData = {
      ...originalTop,
      _id: undefined,
      subject: targetSub._id,
      createdAt: undefined,
      updatedAt: undefined,
    };
    const newTop = await Topic.create(newTopData);
    
    // Add to subject's topicIds
    targetSub.topicIds = targetSub.topicIds || [];
    targetSub.topicIds.push(newTop._id);
    await targetSub.save();

    // 2. Clone MCQs
    const mcqs = await Mcq.find({ topic: originalTop._id, deleted: { $ne: true } }).lean();
    if (mcqs.length > 0) {
      const newMcqs = mcqs.map(m => ({ ...m, _id: undefined, topic: newTop._id, createdAt: undefined, updatedAt: undefined }));
      await Mcq.insertMany(newMcqs);
    }

    // 3. Clone Resources
    const resources = await TopicResource.find({ topic: originalTop._id, deleted: { $ne: true } }).lean();
    for (const res of resources) {
      await TopicResource.create({ ...res, _id: undefined, topic: newTop._id, createdAt: undefined, updatedAt: undefined });
    }

    res.status(201).json(newTop);
  } catch (err) {
    next(err);
  }
};