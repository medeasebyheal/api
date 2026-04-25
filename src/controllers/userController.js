import { User } from '../models/User.js';
import { UserPackage } from '../models/UserPackage.js';
import { Session } from '../models/Session.js';

export const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role, verified } = req.query;

    const filter = { deleted: { $ne: true } };

    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    if (role) filter.role = role;

    if (verified !== undefined) {
      filter.isVerified = verified === 'true';
    }

    const skip = (Number(page) - 1) * Number(limit);

    const { subscribed } = req.query;
    if (subscribed) {
      // Gather active packages and classify free vs paid — only when filter is active
      const activeUps = await UserPackage.find({ status: 'active' }).populate('package').lean().catch(() => []);
      const freeUserIds = new Set();
      const paidUserIds = new Set();
      for (const up of activeUps) {
        const isFree = Boolean(up.package && (String(up.package.type || '').toLowerCase().includes('-free') || Number(up.package.price) === 0));
        if (isFree) freeUserIds.add(String(up.user));
        else paidUserIds.add(String(up.user));
      }

      // Students with academic details are considered subscribed (treated as paid)
      const academicUsers = await User.find({
        role: 'student',
        deleted: { $ne: true },
        $or: [
          { 'academicDetails.institution': { $exists: true, $ne: '' } },
          { 'academicDetails.rollNumber': { $exists: true, $ne: '' } },
          { 'academicDetails.year': { $exists: true } },
        ],
      })
        .distinct('_id')
        .catch(() => []);
      for (const id of academicUsers) paidUserIds.add(String(id));

      const freeIds = Array.from(freeUserIds);
      const paidIds = Array.from(paidUserIds);
      const allSubscribedIds = Array.from(new Set([...freeIds, ...paidIds]));

      if (subscribed === 'free') {
        filter._id = { ...(filter._id || {}), $in: freeIds.length ? freeIds : ['000000000000000000000000'] };
      } else if (subscribed === 'paid') {
        filter._id = { ...(filter._id || {}), $in: paidIds.length ? paidIds : ['000000000000000000000000'] };
      } else if (subscribed === 'true') {
        filter._id = { ...(filter._id || {}), $in: allSubscribedIds.length ? allSubscribedIds : ['000000000000000000000000'] };
      } else if (subscribed === 'false') {
        filter._id = { ...(filter._id || {}), $nin: allSubscribedIds };
      }
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -updatedAt') // include createdAt so frontend can show Joined date
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    // Attach subscription metadata for the frontend to differentiate free trials from paid packages.
    const userIds = users.map((u) => u._id);
    const activePackages = await UserPackage.find({
      user: { $in: userIds },
      status: 'active'
    }).populate('package').lean();

    const pkgByUser = {};
    for (const up of activePackages) {
      pkgByUser[String(up.user)] = up;
    }

    const usersWithSubscription = users.map((u) => {
      const up = pkgByUser[String(u._id)] || null;
      const doc = u.toObject ? u.toObject() : u;
      const hasAcademic =
        doc.role === 'student' &&
        Boolean(doc.academicDetails && (doc.academicDetails.institution || doc.academicDetails.rollNumber || doc.academicDetails.year));
      const hasActivePackage = Boolean(up) || hasAcademic;
      const isFreeTrial = Boolean(
        up && (up.package?.type?.toLowerCase?.().includes('-free') || Number(up.package?.price) === 0)
      );
      return {
        ...doc,
        hasActivePackage,
        isFreeTrial,
      };
    });

    res.json({
      users: usersWithSubscription,
      total,
      page: Number(page),
      limit: Number(limit)
    });

  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -updatedAt') // include createdAt for detail view
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // include subscription metadata
    const up = await UserPackage.findOne({ user: user._id, status: 'active' }).populate('package').lean().catch(() => null);
    const hasAcademic =
      user.role === 'student' &&
      Boolean(user.academicDetails && (user.academicDetails.institution || user.academicDetails.rollNumber || user.academicDetails.year));
    const hasActivePackage = Boolean(up) || hasAcademic;
    const isFreeTrial = Boolean(up && (up.package?.type?.toLowerCase?.().includes('-free') || Number(up.package?.price) === 0));

    res.json({ ...user, hasActivePackage, isFreeTrial });

  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const { name, contact, academicDetails } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, contact, academicDetails },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);

  } catch (err) {
    next(err);
  }
};

export const verify = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hasActivePackage = await UserPackage.findOne({
      user: user._id,
      status: 'active'
    });

    if (!hasActivePackage) {
      return res.status(400).json({
        message: 'User must be subscribed to a package before they can be verified.'
      });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true }
    ).select('-password');

    res.json(updated);

  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { deleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted' });

  } catch (err) {
    next(err);
  }
};

export const block = async (req, res, next) => {
  try {
    const u = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true }
    ).select('-password');

    if (!u) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(u);

  } catch (err) {
    next(err);
  }
};

export const unblock = async (req, res, next) => {
  try {
    const u = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false },
      { new: true }
    ).select('-password');

    if (!u) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(u);

  } catch (err) {
    next(err);
  }
};

export const revokeAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const sessionsResult = await Session.updateMany(
      { user: user._id, valid: true },
      { valid: false }
    ).catch(() => ({ modifiedCount: 0 }));

    const expiredPackagesResult = await UserPackage.updateMany(
      { user: user._id, status: 'active' },
      { status: 'expired', expiresAt: new Date() }
    ).catch(() => ({ modifiedCount: 0 }));

    user.activePlanId = null;
    await user.save().catch(() => { });

    const u = await User.findById(user._id).select('-password');

    res.json({
      message: 'Access revoked',
      user: u,
      expiredPackagesCount: expiredPackagesResult.modifiedCount ?? expiredPackagesResult.nModified ?? 0,
      sessionsInvalidatedCount: sessionsResult.modifiedCount ?? sessionsResult.nModified ?? 0,
    });
  } catch (err) {
    next(err);
  }
};