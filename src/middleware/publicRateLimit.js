import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Rate limiter for public read APIs (content, packages).
 * Per IP to prevent scraping and abuse.
 */
export const publicApiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: Number(process.env.PUBLIC_API_RATE_LIMIT_MAX) || 150,
  message: { message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    res.status(429).json({
      message: options.message?.message ?? 'Too many requests.',
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    });
  },
});

/**
 * Stricter rate limiter for auth endpoints (login, register, verify-otp).
 * Reduces brute-force and abuse.
 */
export const authApiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  message: { message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    res.status(429).json({
      message: options.message?.message ?? 'Too many attempts. Please try again later.',
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    });
  },
});

/**
 * Rate limiter for contact form submissions.
 */
export const contactLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: Number(process.env.CONTACT_RATE_LIMIT_MAX) || 5,
  message: { message: 'Too many contact submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    res.status(429).json({
      message: options.message?.message ?? 'Too many requests.',
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    });
  },
});

/**
 * Rate limiter for promo code validation (public).
 */
export const promoCodeLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: Number(process.env.PROMO_RATE_LIMIT_MAX) || 30,
  message: { message: 'Too many validation attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    res.status(429).json({
      message: options.message?.message ?? 'Too many requests.',
      retryAfter: Math.ceil(WINDOW_MS / 1000),
    });
  },
});
