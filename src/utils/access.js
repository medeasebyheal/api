import { UserPackage } from '../models/UserPackage.js';
import { User } from '../models/User.js';
import { Topic } from '../models/Topic.js';
import { Subject } from '../models/Subject.js';
import { Module } from '../models/Module.js';
import { Year } from '../models/Year.js';
import { Plan } from '../models/Plan.js';
import { Package } from '../models/Package.js';

const isDev = process.env.NODE_ENV === 'development';

/** Return first-topic IDs (by createdAt) for a single module's subjects. */
export async function getFirstTopicsForModule(moduleId) {
  if (!moduleId) return [];
  const subjects = await Subject.find({ module: moduleId }).sort({ createdAt: 1 }).lean();
  if (!subjects || subjects.length === 0) return [];
  const topicIds = [];
  for (const sub of subjects) {
    // eslint-disable-next-line no-await-in-loop
    const topic = await Topic.findOne({ subject: sub._id }).sort({ createdAt: 1 }).lean();
    if (topic) topicIds.push(topic._id?.toString ? topic._id.toString() : topic._id);
  }
  return topicIds;
}

/** Return deduplicated first-topic IDs for multiple modules. */
export async function getFirstTopicsForModules(moduleIds) {
  if (!moduleIds || !moduleIds.length) return [];
  const unique = Array.from(new Set(moduleIds.map((m) => (m?._id || m).toString())));
  const all = [];
  for (const m of unique) {
    // eslint-disable-next-line no-await-in-loop
    const ids = await getFirstTopicsForModule(m);
    if (ids && ids.length) all.push(...ids.map((id) => id.toString()));
  }
  return Array.from(new Set(all));
}

async function canAccessModuleByPlan(userId, moduleId) {
  const user = await User.findById(userId).populate({ path: 'activePlanId' });
  const plan = user?.activePlanId;
  if (!plan) return false;
  // Do not treat free-trial plans as full-access plans.
  if (plan.isFreeTrial) return false;
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
    // Skip trial packages when deciding full-module access; free-trial packages only grant access
    // to selected first-topics via canAccessTopicWithFreeTrial.
    const name = (pkg?.name || '').toString();
    const planKey = pkg?.planKey || '';
    const ptype = (pkg?.type || '').toString();
    const isTrialPkg = /free[-\s]?trial/i.test(name) || /free/i.test(ptype) || String(planKey) === 'free-trial';
    if (isTrialPkg) continue;

    if (pkg?.moduleIds && pkg.moduleIds.some((m) => (m._id || m).toString() === moduleId?.toString())) {
      return { allowed: true };
    }
  }
  return { allowed: false, reason: 'No active package for this content' };
}

export async function canAccessTopicWithFreeTrial(user, topicId) {
  if (isDev) return { allowed: true, freeTrial: true };
  // If user already used freeTrial earlier (legacy flag), allow only that topic
  if (user.freeTrialUsed) {
    return user.freeTrialUsed.toString() === topicId.toString()
      ? { allowed: true, freeTrial: true }
      : { allowed: false, reason: 'Free trial already used for another topic' };
  }

  // Check for active free-trial UserPackage.
  // Try to locate a package explicitly tied to planKey 'free-trial', but fall back to any active UserPackage
  // whose package name or plan indicates a free trial.
  let activeTrial = null;
  const now = new Date();
  const trialQuery = { user: user._id, status: 'active', $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }] };

  const freePlan = await Plan.findOne({ planKey: 'free-trial' }).lean().catch(() => null);
  try {
    let freePkg = null;
    if (freePlan) {
      freePkg = await Package.findOne({ plan: freePlan._id }).lean().catch(() => null);
    }
    if (!freePkg) {
      freePkg = await Package.findOne({ planKey: 'free-trial' }).lean().catch(() => null);
    }
    if (!freePkg) {
      freePkg = await Package.findOne({ name: /free[-\s]?trial/i }).lean().catch(() => null);
    }
    if (!freePkg) {
      // some packages mark free in the type field (e.g. "year_half_part1-free")
      freePkg = await Package.findOne({ type: /free/i }).lean().catch(() => null);
    }

    if (freePkg) {
      activeTrial = await UserPackage.findOne({ ...trialQuery, package: freePkg._id }).lean().catch(() => null);
    }
  } catch (e) {
    // ignore
  }

  // Fallback / expansion: collect all active UserPackages for this user
  // and treat any whose package looks like a free trial as free-trial packages.
  const trialPackages = await UserPackage.find(trialQuery).populate('package').lean().catch(() => []);
  const freeTrialPackages = [];
  for (const up of trialPackages || []) {
    const pkg = up.package;
    if (!pkg) continue;
    const name = (pkg.name || '').toString();
    const planKey = pkg.planKey || '';
    const ptype = (pkg.type || '').toString();
    const isFreeLike =
      /free[-\s]?trial/i.test(name) ||
      /free/i.test(ptype) ||
      String(planKey) === 'free-trial' ||
      (freePlan && String(pkg.plan || '') === String(freePlan._id));
    if (isFreeLike) freeTrialPackages.push(up);
  }

  if (!activeTrial && freeTrialPackages.length > 0) {
    // Keep one representative for backward-compat messages, but we will use
    // all free-trial packages' modules when computing allowed topic IDs.
    activeTrial = freeTrialPackages[0];
  }

  if (!activeTrial && freeTrialPackages.length === 0) {
    return { allowed: false, reason: 'No active free trial' };
  }

  // Build the list of modules from all free-trial packages, then allow the first
  // topic of every subject within those modules.
  const moduleIds = [];
  const packagesToUse = freeTrialPackages.length > 0 ? freeTrialPackages : [activeTrial];
  for (const up of packagesToUse) {
    const pkg = up.package;
    if (!pkg || !Array.isArray(pkg.moduleIds)) continue;
    for (const m of pkg.moduleIds) {
      const id = (m && (m._id || m)) || null;
      if (id) moduleIds.push(id);
    }
  }

  const allowedIds = await getFirstTopicsForModules(moduleIds);
  if (!allowedIds || allowedIds.length === 0) return { allowed: false, reason: 'Free trial topic(s) not available' };
  const allowed = allowedIds.some((id) => id?.toString() === topicId.toString());
  if (!allowed) return { allowed: false, reason: 'Free trial allows only the first topic of each subject in the package modules' };
  return { allowed: true, freeTrial: true };
}

export async function canAccessModule(userId, moduleId) {
  if (isDev) return { allowed: true };
  const byPlan = await canAccessModuleByPlan(userId, moduleId);
  if (byPlan) return { allowed: true };
  const userPackages = await UserPackage.find({ user: userId, status: 'active' }).populate('package');
  for (const up of userPackages) {
    const pkg = up.package;
    // Skip trial packages when deciding full-module access (e.g. for OSPE)
    const name = (pkg?.name || '').toString();
    const planKey = pkg?.planKey || '';
    const isTrialPkg = /free[-\s]?trial/i.test(name) || String(planKey) === 'free-trial';
    if (isTrialPkg) continue;

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
