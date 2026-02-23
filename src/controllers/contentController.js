import { Year } from '../models/Year.js';
import { Module } from '../models/Module.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { TopicResource } from '../models/TopicResource.js';
import { User } from '../models/User.js';
import { ProffStructure } from '../models/ProffStructure.js';
import { canAccessTopic, canAccessTopicWithFreeTrial, canAccessModule } from '../utils/access.js';

export const listProff = async (req, res, next) => {
  try {
    const list = await ProffStructure.find();
    res.json(list);
  } catch (err) {
    next(err);
  }
};

export const listYears = async (req, res, next) => {
  try {
    const years = await Year.find().sort({ order: 1 });
    res.json(years);
  } catch (err) {
    next(err);
  }
};

export const listModules = async (req, res, next) => {
  try {
    const modules = await Module.find({ year: req.params.yearId })
      .sort({ order: 1 })
      .populate('subjectIds');
    res.json(modules);
  } catch (err) {
    next(err);
  }
};

export const getModule = async (req, res, next) => {
  try {
    const mod = await Module.findById(req.params.moduleId).populate('year', 'name');
    if (!mod) return res.status(404).json({ message: 'Module not found' });
    res.json(mod);
  } catch (err) {
    next(err);
  }
};

export const listSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find({ module: req.params.moduleId })
      .sort({ order: 1 })
      .populate('topicIds');
    res.json(subjects);
  } catch (err) {
    next(err);
  }
};

export const getSubject = async (req, res, next) => {
  try {
    const sub = await Subject.findById(req.params.subjectId).populate('module', 'name');
    if (!sub) return res.status(404).json({ message: 'Subject not found' });
    res.json(sub);
  } catch (err) {
    next(err);
  }
};

export const listTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find({ subject: req.params.subjectId }).sort({ order: 1 });
    res.json(topics);
  } catch (err) {
    next(err);
  }
};

export const getTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .populate({ path: 'subject', populate: { path: 'module', select: 'name' } });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const includeMcqs = req.query.includeMcqs === 'true';
    let hasAccess = false;
    let usedFreeTrial = false;

    if (req.user) {
      const withPackage = await canAccessTopic(req.user._id, topic._id);
      if (withPackage.allowed) {
        hasAccess = true;
      } else {
        const withTrial = await canAccessTopicWithFreeTrial(req.user, topic._id);
        if (withTrial.allowed && withTrial.freeTrial) {
          hasAccess = true;
          usedFreeTrial = true;
        }
      }
    }

    if (req.query.useFreeTrial === 'true' && req.user && !req.user.freeTrialUsed && !hasAccess) {
      const trialCheck = await canAccessTopicWithFreeTrial(req.user, topic._id);
      if (trialCheck.allowed) {
        await User.findByIdAndUpdate(req.user._id, { freeTrialUsed: topic._id });
        hasAccess = true;
        usedFreeTrial = true;
      }
    }

    const response = {
      topic: {
        _id: topic._id,
        name: topic.name,
        order: topic.order,
        videoUrl: topic.videoUrl,
        content: hasAccess ? topic.content : undefined,
        subject: topic.subject,
      },
      hasAccess,
      usedFreeTrial,
    };

    if (hasAccess && includeMcqs) {
      const { Mcq } = await import('../models/Mcq.js');
      const mcqs = await Mcq.find({ topic: topic._id }).sort({ order: 1 });
      response.mcqs = mcqs;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
};

export const checkTopicAccess = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ allowed: false, reason: 'Login required' });
    const result = await canAccessTopic(req.user._id, req.params.id);
    if (result.allowed) return res.json({ allowed: true });
    const withTrial = await canAccessTopicWithFreeTrial(req.user, req.params.id);
    res.json({
      allowed: withTrial.allowed,
      canUseFreeTrial: withTrial.allowed && !req.user.freeTrialUsed,
      reason: result.reason,
    });
  } catch (err) {
    next(err);
  }
};

export const checkModuleAccess = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ allowed: false });
    const result = await canAccessModule(req.user._id, req.params.moduleId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const listTopicResources = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.topicId);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });
    const resources = await TopicResource.find({ topic: req.params.topicId }).sort({ order: 1 });
    res.json(resources);
  } catch (err) {
    next(err);
  }
};
