import rateLimit from 'express-rate-limit';

// Rate limiting temporarily disabled for most endpoints, but auth is enabled.
// Export no-op middleware so existing route code doesn't need changes.
const noop = (req, res, next) => next();

export const publicApiLimiter = noop;

export const authApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        return res.status(options.statusCode).json({ message: 'Too many requests from this IP, please try again after 1 minute.' });
    }
});
export const contactLimiter = noop;
export const promoCodeLimiter = noop;
