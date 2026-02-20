import { Program } from '../models/Program.js';
import { Year } from '../models/Year.js';
import { Module } from '../models/Module.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { Mcq } from '../models/Mcq.js';
import { OneShotLecture } from '../models/OneShotLecture.js';
import { Ospe } from '../models/Ospe.js';
import { ProffStructure } from '../models/ProffStructure.js';
import { ProffMcq } from '../models/ProffMcq.js';
import { ProffOspe } from '../models/ProffOspe.js';
import { Package } from '../models/Package.js';
import { PromoCode } from '../models/PromoCode.js';
import { User } from '../models/User.js';
import { Payment } from '../models/Payment.js';
import { parseBulkMcqs } from '../utils/mcqBulkParser.js';

// Programs
export const listPrograms = async (req, res, next) => {
  try {
    const programs = await Program.find().sort({ order: 1 });
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
export const deleteProgram = async (req, res, next) => {
  try {
    const program = await Program.findByIdAndDelete(req.params.id);
    if (!program) return res.status(404).json({ message: 'Program not found' });
    await Year.updateMany({ program: req.params.id }, { $unset: { program: 1 } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// Years
export const listYears = async (req, res, next) => {
  try {
    const filter = req.query.programId ? { program: req.query.programId } : {};
    const years = await Year.find(filter).sort({ order: 1 }).populate('program', 'name order');
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
    const year = await Year.findByIdAndDelete(req.params.id);
    if (!year) return res.status(404).json({ message: 'Year not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// Modules
export const listModules = async (req, res, next) => {
  try {
    const modules = await Module.find({ year: req.params.yearId }).sort({ order: 1 });
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
    const mod = await Module.findByIdAndDelete(req.params.id);
    if (!mod) return res.status(404).json({ message: 'Module not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
export const listAllModules = async (req, res, next) => {
  try {
    const modules = await Module.find().sort({ order: 1 }).populate('year', 'name order');
    res.json(modules);
  } catch (err) {
    next(err);
  }
};

// Subjects
export const listSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find({ module: req.params.moduleId }).sort({ order: 1 });
    res.json(subjects);
  } catch (err) {
    next(err);
  }
};
export const createSubject = async (req, res, next) => {
  try {
    const sub = await Subject.create({ ...req.body, module: req.params.moduleId });
    const mod = await Module.findById(req.params.moduleId);
    if (mod) {
      mod.subjectIds = mod.subjectIds || [];
      mod.subjectIds.push(sub._id);
      await mod.save();
    }
    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
};
export const updateSubject = async (req, res, next) => {
  try {
    const sub = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!sub) return res.status(404).json({ message: 'Subject not found' });
    res.json(sub);
  } catch (err) {
    next(err);
  }
};
export const deleteSubject = async (req, res, next) => {
  try {
    const sub = await Subject.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Subject not found' });
    await Module.updateOne({ _id: sub.module }, { $pull: { subjectIds: sub._id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
export const listAllSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find()
      .sort({ order: 1 })
      .populate({ path: 'module', select: 'name order year', populate: { path: 'year', select: 'name _id' } });
    res.json(subjects);
  } catch (err) {
    next(err);
  }
};

// Topics
export const listTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find({ subject: req.params.subjectId }).sort({ order: 1 });
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
    const topic = await Topic.findByIdAndDelete(req.params.id);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    await Subject.updateOne({ _id: topic.subject }, { $pull: { topicIds: topic._id } });
    await Mcq.deleteMany({ topic: topic._id });
    await OneShotLecture.deleteMany({ topic: topic._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
export const listAllTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find()
      .sort({ order: 1 })
      .populate({ path: 'subject', select: 'name order module', populate: { path: 'module', select: 'name year', populate: { path: 'year', select: 'name _id' } } });
    res.json(topics);
  } catch (err) {
    next(err);
  }
};

// MCQs
export const listMcqs = async (req, res, next) => {
  try {
    const mcqs = await Mcq.find({ topic: req.params.topicId }).sort({ order: 1 });
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
    const mcq = await Mcq.findByIdAndDelete(req.params.mcqId);
    if (!mcq) return res.status(404).json({ message: 'MCQ not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
export const parseBulkMcqsPreview = async (req, res, next) => {
  try {
    const rawText = req.body.text || req.body.raw || '';
    const { mcqs, errors, partialBlockIndices } = parseBulkMcqs(rawText);
    res.json({ mcqs, errors, partialBlockIndices: partialBlockIndices || [] });
  } catch (err) {
    next(err);
  }
};
export const bulkCreateMcqs = async (req, res, next) => {
  try {
    const rawText = req.body.text || req.body.raw || '';
    const { mcqs, errors, partialBlockIndices } = parseBulkMcqs(rawText);
    const created = [];
    for (let i = 0; i < mcqs.length; i++) {
      const m = mcqs[i];
      const doc = await Mcq.create({
        topic: req.params.topicId,
        question: m.question,
        options: m.options,
        correctIndex: m.correctIndex,
        explanation: m.explanation || '',
        videoUrl: m.videoUrl || undefined,
        type: req.body.type || 'text',
        order: i,
      });
      created.push(doc);
    }
    res.status(201).json({ created: created.length, errors, partialBlockIndices: partialBlockIndices || [], mcqs: created });
  } catch (err) {
    next(err);
  }
};

// One Shot Lectures (YouTube lectures per topic)
export const listOneShotLectures = async (req, res, next) => {
  try {
    const lectures = await OneShotLecture.find({ topic: req.params.topicId }).sort({ order: 1 });
    res.json(lectures);
  } catch (err) {
    next(err);
  }
};
export const createOneShotLecture = async (req, res, next) => {
  try {
    const lecture = await OneShotLecture.create({ ...req.body, topic: req.params.topicId });
    res.status(201).json(lecture);
  } catch (err) {
    next(err);
  }
};
export const updateOneShotLecture = async (req, res, next) => {
  try {
    const lecture = await OneShotLecture.findOneAndUpdate(
      { _id: req.params.lectureId, topic: req.params.topicId },
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
    const lecture = await OneShotLecture.findOneAndDelete({ _id: req.params.lectureId, topic: req.params.topicId });
    if (!lecture) return res.status(404).json({ message: 'One shot lecture not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// OSPEs
export const listOspes = async (req, res, next) => {
  try {
    const ospes = await Ospe.find({ module: req.params.moduleId }).sort({ order: 1 });
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
    const ospe = await Ospe.findByIdAndDelete(req.params.id);
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
  { name: 'Paper 1 (Mix MCQs)', type: 'mcq', order: 1 },
  { name: 'Paper 2 (Mix MCQs)', type: 'mcq', order: 2 },
  { name: 'OSPE 1', type: 'ospe', order: 3 },
  { name: 'OSPE 2', type: 'ospe', order: 4 },
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
    const { name, order, papers } = req.body;
    const nextOrder = typeof order === 'number' ? order : (doc.years?.length ?? 0);
    const yearName = name || `Year ${(doc.years?.length ?? 0) + 1}`;
    const yearPapers = Array.isArray(papers) && papers.length > 0 ? papers : DEFAULT_JSMU_PAPERS;
    doc.years.push({ name: yearName, order: nextOrder, papers: yearPapers });
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
    const { name, order, papers } = req.body;
    if (name !== undefined) year.name = name;
    if (order !== undefined) year.order = order;
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
    const { name, order, subjects } = req.body;
    const nextOrder = typeof order === 'number' ? order : (doc.years?.length ?? 0);
    const yearName = name || `Year ${(doc.years?.length ?? 0) + 1}`;
    doc.years.push({ name: yearName, order: nextOrder, subjects: Array.isArray(subjects) ? subjects : [] });
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
    const { name, order, subjects } = req.body;
    if (name !== undefined) year.name = name;
    if (order !== undefined) year.order = order;
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
    }).sort({ order: 1 });
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
    const mcq = await ProffMcq.findOneAndDelete({
      _id: req.params.mcqId,
      university: 'jsmu',
      proffYear: req.params.yearId,
      proffPaper: req.params.paperId,
    });
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
    const { mcqs, errors, partialBlockIndices } = parseBulkMcqs(rawText);
    res.json({ mcqs, errors, partialBlockIndices: partialBlockIndices || [] });
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
    const { mcqs, errors, partialBlockIndices } = parseBulkMcqs(rawText);
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
        videoUrl: m.videoUrl || undefined,
        type: req.body.type || 'text',
        order: i,
      });
      created.push(doc);
    }
    res.status(201).json({ created: created.length, errors, partialBlockIndices: partialBlockIndices || [], mcqs: created });
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
    }).sort({ order: 1 });
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
    const mcq = await ProffMcq.findOneAndDelete({
      _id: req.params.mcqId,
      university: 'other',
      proffYear: req.params.yearId,
      proffSubject: req.params.subjectId,
    });
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
    const { mcqs, errors, partialBlockIndices } = parseBulkMcqs(rawText);
    res.json({ mcqs, errors, partialBlockIndices: partialBlockIndices || [] });
  } catch (err) {
    next(err);
  }
};
export const bulkCreateProffOtherSubjectMcqs = async (req, res, next) => {
  try {
    const { year, subject } = await getOtherYearAndSubject(req.params.yearId, req.params.subjectId);
    if (!year || !subject) return res.status(404).json({ message: 'Year or subject not found' });
    const rawText = req.body.text || req.body.raw || '';
    const { mcqs, errors, partialBlockIndices } = parseBulkMcqs(rawText);
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
        videoUrl: m.videoUrl || undefined,
        type: req.body.type || 'text',
        order: i,
      });
      created.push(doc);
    }
    res.status(201).json({ created: created.length, errors, partialBlockIndices: partialBlockIndices || [], mcqs: created });
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
    const pkg = await Package.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// Dashboard stats
export const dashboardStats = async (req, res, next) => {
  try {
    const [userCount, pendingPayments, programCount, yearCount, moduleCount, topicCount, mcqCount] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Payment.countDocuments({ status: 'pending' }),
      Program.countDocuments(),
      Year.countDocuments(),
      Module.countDocuments(),
      Topic.countDocuments(),
      Mcq.countDocuments(),
    ]);
    res.json({
      userCount,
      pendingPayments,
      programCount,
      yearCount,
      moduleCount,
      topicCount,
      mcqCount,
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
    const promo = await PromoCode.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo code not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
