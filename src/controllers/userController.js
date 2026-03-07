import { User } from '../models/User.js';
import { UserPackage } from '../models/UserPackage.js';

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

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -updatedAt -createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    res.json({
      users,
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
      .select('-password -updatedAt -createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);

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