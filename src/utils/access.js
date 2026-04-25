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

  // Use aggregation to get first topic per subject in a SINGLE query
  // instead of N+1 (one Subject.find + one Topic.findOne per subject).
  const results = await Subject.aggregate([
    { $match: { module: moduleId } },
    {
      $lookup: {
        from: 'topics',
        let: { subjectId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$subject', '$$subjectId'] } } },
          { $sort: { createdAt: 1 } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: 'firstTopic',
      },
    },
    { $unwind: { path: '$firstTopic', preserveNullAndEmptyArrays: false } },
    { $project: { topicId: '$firstTopic._id' } },
  ]);

  return results.map((r) => r.topicId.toString());
}

/** Return deduplicated first-topic IDs for multiple modules. */
export async function getFirstTopicsForModules(moduleIds) {
  if (!moduleIds || !moduleIds.length) return [];
  const unique = Array.from(new Set(moduleIds.map((m) => (m?._id || m).toString())));

  // Run all modules in parallel instead of serial for-loop
  const allArrays = await Promise.all(unique.map((m) => getFirstTopicsForModule(m)));
  const all = allArrays.flat().map((id) => id.toString());
  return Array.from(new Set(all));
}

async function canAccessModuleByPlan(userId, moduleId) {
  const user = await User.findById(userId).populate({ path: 'activePlanId' }).lean();
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
  const topic = await Topic.findById(topicId).populate({ path: 'subject', populate: { path: 'module' } }).lean();
  if (!topic) return { allowed: false, reason: 'Topic not found' };
  const moduleId = topic.subject?.module?._id || topic.subject?.module;
  if (!moduleId) return { allowed: false, reason: 'Topic has no module' };
  const byPlan = await canAccessModuleByPlan(userId, moduleId);
  if (byPlan) return { allowed: true };
  const userPackages = await UserPackage.find({ user: userId, status: 'active' }).populate('package').lean();
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

  // --- Collapsed Package lookup: single query instead of 4 cascading findOne calls ---
  const freePlan = await Plan.findOne({ planKey: 'free-trial' }).lean().catch(() => null);

  const pkgOrConditions = [
    { planKey: 'free-trial' },
    { name: /free[-\s]?trial/i },
    { type: /free/i },
  ];
  if (freePlan) {
    pkgOrConditions.unshift({ plan: freePlan._id });
  }

  const allFreePackages = await Package.find({ $or: pkgOrConditions }).lean().catch(() => []);

  if (!allFreePackages || allFreePackages.length === 0) {
    return { allowed: false, reason: 'No active free trial' };
  }

  const freePkgIds = allFreePackages.map((p) => p._id);
  const now = new Date();

  // Single query to get all active free-trial UserPackages for this user
  const trialUserPackages = await UserPackage.find({
    user: user._id,
    status: 'active',
    package: { $in: freePkgIds },
    $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }],
  })
    .populate('package')
    .lean()
    .catch(() => []);

  if (!trialUserPackages || trialUserPackages.length === 0) {
    return { allowed: false, reason: 'No active free trial' };
  }

  // Build the list of modules from all free-trial packages, then allow the first
  // topic of every subject within those modules.
  const moduleIds = [];
  for (const up of trialUserPackages) {
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
  const userPackages = await UserPackage.find({ user: userId, status: 'active' }).populate('package').lean();
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
  const user = await User.findById(userId).populate({ path: 'activePlanId' }).lean();
  const plan = user?.activePlanId;
  if (plan && plan.proffPapers && plan.proffPapers.length > 0) {
    return { allowed: true };
  }
  const userPackages = await UserPackage.find({ user: userId, status: 'active' }).populate('package').lean();
  for (const up of userPackages) {
    const pkg = up.package;
    if (pkg?.type === 'master_proff' && pkg?.proffPapers?.length) {
      return { allowed: true };
    }
  }
  return { allowed: false };
}
