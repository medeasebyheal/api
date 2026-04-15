import { Year } from '../models/Year.js';
import { Module } from '../models/Module.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { TopicResource } from '../models/TopicResource.js';
import { OneShotLecture } from '../models/OneShotLecture.js';
import { Ospe } from '../models/Ospe.js';
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
    const years = await Year.find().sort({ createdAt: 1 }).select('_id name').lean();
    res.json(years);
  } catch (err) {
    next(err);
  }
};

export const listYearsWithModules = async (req, res, next) => {
  try {
    const years = await Year.find().sort({ createdAt: 1 }).select('_id name').lean();
    const yearIds = years.map((y) => y._id);

    const modules = await Module.find({ year: { $in: yearIds } })
      .select('_id name description imageUrl year')
      .sort({ createdAt: 1 })
      .lean();

    const modulesByYear = {};

    modules.forEach((m) => {
      const y = String(m.year);
      if (!modulesByYear[y]) modulesByYear[y] = [];
      modulesByYear[y].push(m);
    });

    const result = years.map((y) => ({
      ...y,
      modules: modulesByYear[String(y._id)] || []
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const listModules = async (req, res, next) => {
  try {
    const modules = await Module.find({ year: req.params.yearId })
      .sort({ createdAt: 1 })
      .select('_id name description imageUrl year')
      .lean();

    res.json(modules);
  } catch (err) {
    next(err);
  }
};

export const getModule = async (req, res, next) => {
  try {
    const mod = await Module.findById(req.params.moduleId)
      .select('_id name description imageUrl year')
      .lean();

    if (!mod) return res.status(404).json({ message: 'Module not found' });

    res.json(mod);
  } catch (err) {
    next(err);
  }
};

export const listSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find({ module: req.params.moduleId })
      .sort({ createdAt: 1 })
      .select('_id name imageUrl module')
      .lean();

    res.json(subjects);
  } catch (err) {
    next(err);
  }
};

export const getSubject = async (req, res, next) => {
  try {
    const sub = await Subject.findById(req.params.subjectId)
      .select('_id name imageUrl videoUrls module')
      .lean();

    if (!sub) return res.status(404).json({ message: 'Subject not found' });

    res.json(sub);
  } catch (err) {
    next(err);
  }
};

export const listTopics = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(10, Math.min(100, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const topics = await Topic.find({ subject: req.params.subjectId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .select('_id name imageUrl createdAt')
      .lean();

    res.json({ topics, page, limit });
  } catch (err) {
    next(err);
  }
};

export const getTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .populate({ path: 'subject', populate: { path: 'module', select: 'name' } })
      .lean();

    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const includeMcqs = req.query.includeMcqs === 'true';

    let hasAccess = false;
    let usedFreeTrial = false;
    let canUseFreeTrialForThisTopic = false;

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

        if (!req.user.freeTrialUsed && withTrial.allowed) {
          canUseFreeTrialForThisTopic = true;
        }
      }
    }

    if (
      req.query.useFreeTrial === 'true' &&
      req.user &&
      !req.user.freeTrialUsed &&
      !hasAccess
    ) {
      const trialCheck = await canAccessTopicWithFreeTrial(req.user, topic._id);

      if (trialCheck.allowed) {
        await User.findByIdAndUpdate(req.user._id, { freeTrialUsed: topic._id });

        hasAccess = true;
        usedFreeTrial = true;
        canUseFreeTrialForThisTopic = false;
      }
    }

    const response = {
      topic: {
        _id: topic._id,
        name: topic.name,
        imageUrl: topic.imageUrl,
        videoUrl: topic.videoUrl,
        videoUrls: topic.videoUrls,
        content: hasAccess ? topic.content : undefined,
        subject: topic.subject,
      },
      hasAccess,
      usedFreeTrial,
      canUseFreeTrialForThisTopic,
    };

    if (hasAccess && includeMcqs) {
      const { Mcq } = await import('../models/Mcq.js');
      const mcqs = await Mcq.find({ topic: topic._id }).sort({ createdAt: 1 });
      response.mcqs = mcqs;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
};

export const checkTopicAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ allowed: false, reason: 'Login required' });
    }

    const result = await canAccessTopic(req.user._id, req.params.id);

    if (result.allowed) {
      return res.json({ allowed: true });
    }

    const withTrial = await canAccessTopicWithFreeTrial(req.user, req.params.id);

    const payload = {
      allowed: withTrial.allowed,
      canUseFreeTrial: withTrial.allowed && !req.user.freeTrialUsed,
      reason: result.reason,
    };

    res.json(payload);
  } catch (err) {
    next(err);
  }
};

export const checkModuleAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ allowed: false });
    }

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

    const resources = await TopicResource.find({ topic: req.params.topicId })
      .sort({ createdAt: 1 })
      .lean();

    res.json(resources);
  } catch (err) {
    next(err);
  }
};

export const listSubjectOneShotLectures = async (req, res, next) => {
  try {
    const lectures = await OneShotLecture.find({ subject: req.params.subjectId })
      .sort({ createdAt: 1 })
      .lean();

    res.json(lectures);
  } catch (err) {
    next(err);
  }
};

export const listModuleOspesPublic = async (req, res, next) => {
  try {
    const ospes = await Ospe.find({ module: req.params.moduleId })
      .select('_id name description')
      .sort({ createdAt: 1 })
      .lean();

    res.json(ospes);
  } catch (err) {
    next(err);
  }
};