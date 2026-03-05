// Rate limiting temporarily disabled.
// Export no-op middleware so existing route code doesn't need changes.
const noop = (req, res, next) => next();

export const publicApiLimiter = noop;
export const authApiLimiter = noop;
export const contactLimiter = noop;
export const promoCodeLimiter = noop;
