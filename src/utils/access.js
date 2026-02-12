import { UserPackage } from '../models/UserPackage.js';
import { Topic } from '../models/Topic.js';
import { Subject } from '../models/Subject.js';
import { Module } from '../models/Module.js';

export async function canAccessTopic(userId, topicId) {
  const topic = await Topic.findById(topicId).populate({ path: 'subject', populate: { path: 'module' } });
  if (!topic) return { allowed: false, reason: 'Topic not found' };
  const userPackages = await UserPackage.find({ user: userId, status: 'active' }).populate('package');
  const moduleId = topic.subject?.module?._id || topic.subject?.module;
  for (const up of userPackages) {
    const pkg = up.package;
    if (pkg?.moduleIds && pkg.moduleIds.some((m) => (m._id || m).toString() === moduleId?.toString())) {
      return { allowed: true };
    }
  }
  return { allowed: false, reason: 'No active package for this content' };
}

export async function canAccessTopicWithFreeTrial(user, topicId) {
  if (user.freeTrialUsed) {
    return user.freeTrialUsed.toString() === topicId.toString()
      ? { allowed: true, freeTrial: true }
      : { allowed: false, reason: 'Free trial already used for another topic' };
  }
  return { allowed: true, freeTrial: true };
}

export async function canAccessModule(userId, moduleId) {
  const userPackages = await UserPackage.find({ user: userId, status: 'active' }).populate('package');
  for (const up of userPackages) {
    const pkg = up.package;
    if (pkg?.moduleIds?.some((m) => (m._id || m).toString() === moduleId.toString())) {
      return { allowed: true };
    }
  }
  return { allowed: false };
}
