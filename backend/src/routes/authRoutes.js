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
const { authLimiter, refreshLimiter } = require('../middlewares/rateLimitMiddleware');

const router = Router();

router.post('/login', authLimiter, loginHandler);
router.post('/refresh', refreshLimiter, refreshHandler);
router.get('/me', requireAuth, meHandler);
router.post('/logout', requireAuth, logoutHandler);
router.post('/staff', requireAuth, createStaffHandler);
router.post('/staff/invite', requireAuth, createStaffInviteHandler);
router.get('/staff/invite/preview', previewStaffInviteHandler);
router.post('/staff/invite/complete', authLimiter, completeStaffInviteHandler);
router.post('/staff/:userId/password', requireAuth, resetPasswordHandler);
router.post('/change-password', requireAuth, changePasswordHandler);

module.exports = { authRoutes: router };
