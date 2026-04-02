import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { UserPackage } from '../models/UserPackage.js';
import { Plan } from '../models/Plan.js';
import { Package } from '../models/Package.js';
import { OtpVerification } from '../models/OtpVerification.js';
import { sendRegistrationConfirmation, sendOtpVerification } from '../utils/email.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { Session } from '../models/Session.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { sendPasswordResetEmail } from '../utils/email.js';

const signToken = (userId, sid) =>
  jwt.sign(sid ? { userId, sid } : { userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

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
    const { name, email, password, contact, university, college } = req.body;
    // basic server-side validation
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Full name is required' });
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'A valid email is required' });
    if (!contact || String(contact).replace(/\D/g, '').length < 10) return res.status(400).json({ message: 'A valid contact number is required' });
    if (!university || !String(university).trim()) return res.status(400).json({ message: 'University is required' });
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
    const { email, otp, name, password, contact, university, college } = req.body;
    // validate required 
   
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
    const user = await User.create({ name, email, password, contact: contact || '', university, college, role: 'student', isVerified: true });
    // Try to assign free-trial packages. Projects may use a Plan document or only Package records.
    const freeTrialPlan = await Plan.findOne({ planKey: 'free-trial' }).catch(() => null);
    if (freeTrialPlan) {
      user.activePlanId = freeTrialPlan._id;
      await user.save();
    }

    // Find ALL Packages to use for the free trial. Try several fallbacks for different schemas:
    // 1) Packages that reference the Plan (package.plan === freeTrialPlan._id)
    // 2) Packages with a planKey field (package.planKey === 'free-trial')
    // 3) Packages whose name contains "free trial"
    // 4) Packages that encode free in the type field (e.g. 'year_half_part1-free')
    try {
      const freePkgQuery = [];
      if (freeTrialPlan) {
        freePkgQuery.push({ plan: freeTrialPlan._id });
      }
      freePkgQuery.push(
        { planKey: 'free-trial' },
        { name: /free[-\s]?trial/i },
        { type: /-free$/i }
      );

      const freePkgs = await Package.find({ $or: freePkgQuery }).catch(() => []);

      if (freePkgs && freePkgs.length > 0) {
        const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
        for (const pkg of freePkgs) {
          // eslint-disable-next-line no-await-in-loop
          await UserPackage.create({
            user: user._id,
            package: pkg._id,
            status: 'active',
            approvedAt: new Date(),
            expiresAt,
          });
        }
      }
    } catch (err) {
      // do not block registration on failures here
      console.warn('free-trial assignment failed', err?.message || err);
    }
    await OtpVerification.deleteOne({ _id: record._id });
    await sendRegistrationConfirmation(email, name).catch(() => { });
    // create a session for the newly registered student
    const session = await Session.create({
      user: user._id,
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip,
    });
    const token = signToken(user._id, session._id);
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
    // For students, invalidate previous sessions so only one device remains active
    if (user.role === 'student') {
      await Session.updateMany({ user: user._id }, { valid: false }).catch(() => { });
    }
    const session = await Session.create({
      user: user._id,
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip,
    });
    const token = signToken(user._id, session._id);
    const packages = await UserPackage.find({ user: user._id, status: 'active' }).populate('package');
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

export const logout = async (req, res, next) => {
  try {
    const sid = req.session?._id || (req.user && req.user.currentSid);
    if (sid) {
      await Session.findByIdAndUpdate(sid, { valid: false }).catch(() => { });
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await User.findOne({ email });
    if (!user) {
      // respond with success to avoid exposing registered emails
      return res.json({ message: 'If this email exists, a password reset link has been sent' });
    }
    // generate token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + (Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 60) * 60 * 1000));
    await PasswordResetToken.create({ user: user._id, tokenHash, expiresAt });
    const sendResult = await sendPasswordResetEmail(user.email, token, user.name).catch((err) => {
      console.warn('sendPasswordResetEmail failed', err);
      return { sent: false, error: err?.message || 'send failed' };
    });
    res.json({ message: 'If this email exists, a password reset link has been sent', sent: Boolean(sendResult?.sent) });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, email, password } = req.body;
    if (!token || !email || !password) return res.status(400).json({ message: 'Token, email and new password are required' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await PasswordResetToken.findOne({ tokenHash, used: false, expiresAt: { $gt: new Date() } }).populate('user');
    if (!record || !record.user || String(record.user.email).toLowerCase() !== String(email).toLowerCase()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    const user = await User.findById(record.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = password;
    await user.save();
    record.used = true;
    await record.save();
    // invalidate all sessions for this user
    await Session.updateMany({ user: user._id }, { valid: false }).catch(() => { });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    const packages = await UserPackage.find({ user: req.user._id, status: 'active' })
      .populate('package');
    const userObj = { ...req.user.toObject(), packages };
    // Always return fresh user data for /me to avoid 304 Not Modified for critical endpoints
    // and prevent stale cached responses in clients.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({ user: userObj });
  } catch (err) {
    next(err);
  }
};

export const pingStreak = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const todayUTC = new Date();
    // normalize to UTC date (midnight)
    const today = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()));

    let last = user.studyStreakLastDate ? new Date(user.studyStreakLastDate) : null;
    let lastDateUTC = last
      ? new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()))
      : null;

    if (lastDateUTC && lastDateUTC.getTime() === today.getTime()) {
      // already pinged today
      return res.json({
        studyStreakDays: user.studyStreakDays || 0,
        studyStreakGoal: user.studyStreakGoal || 30,
        message: 'Streak already recorded for today',
      });
    }

    // If last was yesterday -> increment, otherwise reset to 1
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    if (lastDateUTC && lastDateUTC.getTime() === yesterday.getTime()) {
      user.studyStreakDays = (user.studyStreakDays || 0) + 1;
    } else {
      user.studyStreakDays = 1;
    }
    user.studyStreakLastDate = today;
    if (!user.studyStreakGoal) user.studyStreakGoal = 30;
    await user.save();

    const packages = await UserPackage.find({ user: user._id, status: 'active' }).populate('package');
    const u = await User.findById(user._id).select('-password');
    res.json({
      message: 'Streak updated',
      studyStreakDays: u.studyStreakDays || 0,
      studyStreakGoal: u.studyStreakGoal || 30,
      user: { ...u.toObject(), packages },
    });
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
    if (!contact || String(contact).replace(/\D/g, '').length < 10) return res.status(400).json({ message: 'A valid contact number is required' });
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
