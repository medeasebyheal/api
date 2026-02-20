import { UserPackage } from '../models/UserPackage.js';
import { User } from '../models/User.js';
import { Topic } from '../models/Topic.js';
import { Subject } from '../models/Subject.js';
import { Module } from '../models/Module.js';

const isDev = process.env.NODE_ENV === 'development';

async function canAccessModuleByPlan(userId, moduleId) {
  const user = await User.findById(userId).populate({ path: 'activePlanId' });
  const plan = user?.activePlanId;
  if (!plan) return false;
  if (plan.proffPapers && plan.proffPapers.length > 0) {
    return false;
  }
  if (!plan.moduleIds || !plan.moduleIds.length) return false;
  return plan.moduleIds.some((m) => (m._id || m).toString() === moduleId.toString());
}

export async function canAccessTopic(userId, topicId) {
  if (isDev) return { allowed: true };
  const topic = await Topic.findById(topicId).populate({ path: 'subject', populate: { path: 'module' } });
  if (!topic) return { allowed: false, reason: 'Topic not found' };
  const moduleId = topic.subject?.module?._id || topic.subject?.module;
  if (!moduleId) return { allowed: false, reason: 'Topic has no module' };
  const byPlan = await canAccessModuleByPlan(userId, moduleId);
  if (byPlan) return { allowed: true };
  const userPackages = await UserPackage.find({ user: userId, status: 'active' }).populate('package');
  for (const up of userPackages) {
    const pkg = up.package;
    if (pkg?.moduleIds && pkg.moduleIds.some((m) => (m._id || m).toString() === moduleId?.toString())) {
      return { allowed: true };
    }
  }
  return { allowed: false, reason: 'No active package for this content' };
}

export async function canAccessTopicWithFreeTrial(user, topicId) {
  if (isDev) return { allowed: true, freeTrial: true };
  if (user.freeTrialUsed) {
    return user.freeTrialUsed.toString() === topicId.toString()
      ? { allowed: true, freeTrial: true }
      : { allowed: false, reason: 'Free trial already used for another topic' };
  }
  return { allowed: true, freeTrial: true };
}

export async function canAccessModule(userId, moduleId) {
  if (isDev) return { allowed: true };
  const byPlan = await canAccessModuleByPlan(userId, moduleId);
  if (byPlan) return { allowed: true };
  const userPackages = await UserPackage.find({ user: userId, status: 'active' }).populate('package');
  for (const up of userPackages) {
    const pkg = up.package;
    if (pkg?.moduleIds?.some((m) => (m._id || m).toString() === moduleId.toString())) {
      return { allowed: true };
    }
  }
  return { allowed: false };
}

export async function canAccessProff(userId) {
  if (isDev) return { allowed: true };
  const user = await User.findById(userId).populate({ path: 'activePlanId' });
  const plan = user?.activePlanId;
  if (plan && plan.proffPapers && plan.proffPapers.length > 0) {
    return { allowed: true };
  }
  const userPackages = await UserPackage.find({ user: userId, status: 'active' }).populate('package');
  for (const up of userPackages) {
    const pkg = up.package;
    if (pkg?.type === 'master_proff' && pkg?.proffPapers?.length) {
      return { allowed: true };
    }
  }
  return { allowed: false };
}
