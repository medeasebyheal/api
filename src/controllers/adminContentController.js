import { Program } from '../models/Program.js';
import { Year } from '../models/Year.js';
import { Module } from '../models/Module.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { Mcq } from '../models/Mcq.js';
import { Ospe } from '../models/Ospe.js';
import { ProffStructure } from '../models/ProffStructure.js';
import { Package } from '../models/Package.js';
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
