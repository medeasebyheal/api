import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (user.isBlocked) {
      return res.status(401).json({ message: 'Account blocked' });
    }

    // Ensure session is valid (single-device enforcement for students)
    if (!decoded.sid) {
      return res.status(401).json({ message: 'Session identifier missing' });
    }
    const session = await Session.findById(decoded.sid).catch(() => null);
    if (!session || !session.valid || String(session.user) !== String(decoded.userId)) {
      return res.status(401).json({ message: 'Session invalid' });
    }
    // Throttle lastSeen writes to once per 5 minutes to reduce DB connection usage
    const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
    const now = Date.now();
    const lastSeen = session.lastSeen ? new Date(session.lastSeen).getTime() : 0;
    if (now - lastSeen > LAST_SEEN_THROTTLE_MS) {
      session.lastSeen = new Date(now);
      session.save().catch(() => {});  // fire-and-forget, don't await
    }
    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    next(err);
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  const role = req.user.role;
  const allowed = roles.includes(role) || (roles.includes('admin') && role === 'superadmin');
  if (!allowed) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

export const requireVerified = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (!req.user.isVerified) {
    return res.status(403).json({ message: 'Account must be verified to access this resource' });
  }
  next();
};
