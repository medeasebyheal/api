import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { UserPackage } from '../models/UserPackage.js';
import { sendRegistrationConfirmation } from '../utils/email.js';

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

export const register = async (req, res, next) => {
  try {
    const { name, email, password, contact } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const user = await User.create({ name, email, password, contact, role: 'student' });
    await sendRegistrationConfirmation(email, name).catch(() => {});
    const token = signToken(user._id);
    const u = await User.findById(user._id).select('-password');
    res.status(201).json({
      token,
      user: u,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = signToken(user._id);
    const packages = await UserPackage.find({ user: user._id, status: 'active' })
      .populate('package');
    const u = await User.findById(user._id).select('-password');
    res.json({
      token,
      user: { ...u.toObject(), packages },
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    const packages = await UserPackage.find({ user: req.user._id, status: 'active' })
      .populate('package');
    res.json({ user: { ...req.user.toObject(), packages } });
  } catch (err) {
    next(err);
  }
};

/**
 * Create super admin. Requires SUPER_ADMIN_SECRET in env and in request (body.secret or header x-super-admin-secret).
 */
export const createAdmin = async (req, res, next) => {
  try {
    const secret = process.env.SUPER_ADMIN_SECRET;
    if (!secret) {
      return res.status(503).json({ message: 'Super admin creation not configured' });
    }
    const provided = req.body.secret || req.headers['x-super-admin-secret'];
    if (provided !== secret) {
      return res.status(403).json({ message: 'Invalid secret' });
    }
    const { name, email, password, contact } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const user = await User.create({
      name: name || 'Super Admin',
      email,
      password,
      contact: contact || '',
      role: 'admin',
      isVerified: true,
    });
    const u = await User.findById(user._id).select('-password');
    res.status(201).json({
      message: 'Super admin created',
      user: u,
    });
  } catch (err) {
    next(err);
  }
};
