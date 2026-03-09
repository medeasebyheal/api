import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate limiter for MCQ parse (preview) API calls that trigger Gemini/parser.
 * Keys by admin user id so each admin has their own quota; prevents exhausting
 * Gemini keys and protects the server from burst traffic.
 * Configure via env: PARSE_RATE_LIMIT_WINDOW_MS, PARSE_RATE_LIMIT_MAX.
 */
const PARSE_WINDOW_MS = Number(process.env.PARSE_RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const PARSE_MAX_PER_WINDOW = Math.max(1, Math.min(100, Number(process.env.PARSE_RATE_LIMIT_MAX) || 20));

export const parseMcqRateLimiter = rateLimit({
  windowMs: PARSE_WINDOW_MS,
  max: PARSE_MAX_PER_WINDOW,
  message: { message: 'Too many parse requests. Please wait a minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?._id) return req.user._id.toString();
    const ip = req.ip || req.socket?.remoteAddress || '0.0.0.0';
    return ipKeyGenerator(ip);
  },
  handler: (req, res, _next, options) => {
    res.status(429).json({
      message: options.message?.message ?? 'Too many requests.',
      retryAfter: Math.ceil(PARSE_WINDOW_MS / 1000),
    });
  },
});
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 5;

const userRequests = new Map();

export function rateLimitUser(req, res, next) {
  const userId = req.user?._id?.toString();

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const now = Date.now();
  const entry = userRequests.get(userId);

  if (!entry) {
    userRequests.set(userId, { count: 1, start: now });
    return next();
  }

  if (now - entry.start > WINDOW_MS) {
    userRequests.set(userId, { count: 1, start: now });
    return next();
  }

  if (entry.count >= MAX_REQUESTS) {
    return res.status(429).json({
      message: 'Rate limit exceeded. You can only send 5 requests per minute.',
    });
  }

  entry.count += 1;
  next();
}