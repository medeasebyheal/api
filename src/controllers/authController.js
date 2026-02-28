import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { UserPackage } from '../models/UserPackage.js';
import { Plan } from '../models/Plan.js';
import { OtpVerification } from '../models/OtpVerification.js';
import { sendRegistrationConfirmation, sendOtpVerification } from '../utils/email.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

function generateOtp(length = 6) {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
}

export const register = async (req, res, next) => {
  try {
    const { name, email, password, contact } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const otp = generateOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await OtpVerification.deleteMany({ email });
    await OtpVerification.create({ email, otp, expiresAt });
    await sendOtpVerification(email, otp, name).catch((err) => console.warn('OTP email failed:', err));
    res.status(200).json({
      pendingVerification: true,
      email,
      message: 'Verification code sent to your email',
    });
  } catch (err) {
    next(err);
  }
};

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp, name, password, contact } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const record = await OtpVerification.findOne({ email, otp });
    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }
    if (new Date() > record.expiresAt) {
      await OtpVerification.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'Verification code has expired' });
    }
    const user = await User.create({ name, email, password, contact: contact || '', role: 'student' });
    const freeTrialPlan = await Plan.findOne({ planKey: 'free-trial' });
    if (freeTrialPlan) {
      user.activePlanId = freeTrialPlan._id;
      await user.save();
    }
    await OtpVerification.deleteOne({ _id: record._id });
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
    if (user.isBlocked) {
      return res.status(401).json({ message: 'Account blocked' });
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

export const updateProfile = async (req, res, next) => {
  try {
    const { name, contact, academicDetails } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, contact, academicDetails },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const packages = await UserPackage.find({ user: user._id, status: 'active' }).populate('package');
    res.json({ user: { ...user.toObject(), packages } });
  } catch (err) {
    next(err);
  }
};

export const updateProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Profile image required' });
    const result = await uploadToCloudinary(req.file.buffer, 'medease/avatars');
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatarUrl: result.secure_url },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const packages = await UserPackage.find({ user: user._id, status: 'active' }).populate('package');
    res.json({ user: { ...user.toObject(), packages } });
  } catch (err) {
    next(err);
  }
};

/**
 * Create super admin. Callable only once per deployment.
 * Requires SUPER_ADMIN_SECRET in env and in request (body.secret or header x-super-admin-secret).
 * After the first admin exists, this endpoint returns 410 Gone.
 */
export const createAdmin = async (req, res, next) => {
  try {
    const existingAdmin = await User.findOne({ role: { $in: ['admin', 'superadmin'] } });
    if (existingAdmin) {
      return res.status(410).json({
        message: 'Super admin already exists. This endpoint can only be used once.',
      });
    }

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
      role: 'superadmin',
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
