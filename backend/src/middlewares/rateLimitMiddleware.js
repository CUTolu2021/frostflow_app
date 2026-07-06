const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication requests. Try again later.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many token refresh requests. Try again later.' },
});

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many write requests. Please slow down.' },
});

const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.user?.id || 'anonymous'}:invite`,
  message: { message: 'Too many staff invites created. Please wait a bit and try again.' },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.user?.id || 'anonymous'}:${req.params?.userId || 'self'}:password-reset`,
  message: { message: 'Too many password reset attempts. Please wait and try again.' },
});

module.exports = {
  authLimiter,
  refreshLimiter,
  writeLimiter,
  inviteLimiter,
  passwordResetLimiter,
};
