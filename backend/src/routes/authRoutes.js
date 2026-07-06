const { Router } = require('express');
const {
  createStaffHandler,
  createStaffInviteHandler,
  completeStaffInviteHandler,
  previewStaffInviteHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  resetPasswordHandler,
  changePasswordHandler,
} = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');
const {
  authLimiter,
  refreshLimiter,
  inviteLimiter,
  passwordResetLimiter,
} = require('../middlewares/rateLimitMiddleware');

const router = Router();

router.post('/login', authLimiter, loginHandler);
router.post('/refresh', refreshLimiter, refreshHandler);
router.get('/me', requireAuth, meHandler);
router.post('/logout', requireAuth, logoutHandler);
router.post('/staff', requireAuth, createStaffHandler);
router.post('/staff/invite', requireAuth, inviteLimiter, createStaffInviteHandler);
router.get('/staff/invite/preview', previewStaffInviteHandler);
router.post('/staff/invite/complete', authLimiter, completeStaffInviteHandler);
router.post('/staff/:userId/password', requireAuth, passwordResetLimiter, resetPasswordHandler);
router.post('/change-password', requireAuth, passwordResetLimiter, changePasswordHandler);

module.exports = { authRoutes: router };
