const { asyncHandler } = require('../utils/asyncHandler');
const {
  login,
  logout,
  refresh,
  createStaffInvite,
  completeStaffInviteSignup,
  previewStaffInvite,
  registerStaff,
  resetUserPassword,
  changeOwnPassword,
} = require('../services/authService');

const loginHandler = asyncHandler(async (req, res) => {
  const result = await login({
    email: req.body?.email,
    password: req.body?.password,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  res.json({
    token: result.accessToken,
    refreshToken: result.refreshToken,
    sessionId: result.sessionId,
    user: result.user,
  });
});

const meHandler = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

const refreshHandler = asyncHandler(async (req, res) => {
  const result = await refresh({
    refreshToken: req.body?.refreshToken,
  });

  res.json({
    token: result.accessToken,
    refreshToken: result.refreshToken,
    sessionId: result.sessionId,
    user: result.user,
  });
});

const logoutHandler = asyncHandler(async (req, res) => {
  await logout({
    userId: req.user.id,
    refreshToken: req.body?.refreshToken,
  });
  res.json({ success: true });
});

const createStaffHandler = asyncHandler(async (req, res) => {
  const user = await registerStaff({
    actor: req.user,
    name: req.body?.name,
    email: req.body?.email,
    password: req.body?.password,
    role: req.body?.role,
    organizationId: req.body?.organizationId,
  });

  res.status(201).json({ user });
});

const resetPasswordHandler = asyncHandler(async (req, res) => {
  const user = await resetUserPassword({
    actor: req.user,
    userId: req.params.userId,
    nextPassword: req.body?.password,
  });

  res.json({ user });
});

const changePasswordHandler = asyncHandler(async (req, res) => {
  const user = await changeOwnPassword({
    actor: req.user,
    currentPassword: req.body?.currentPassword,
    nextPassword: req.body?.nextPassword,
  });

  res.json({ user });
});

const createStaffInviteHandler = asyncHandler(async (req, res) => {
  const invite = await createStaffInvite({
    actor: req.user,
    email: req.body?.email,
    role: req.body?.role,
    organizationId: req.body?.organizationId,
  });

  res.status(201).json({ invite });
});

const completeStaffInviteHandler = asyncHandler(async (req, res) => {
  const user = await completeStaffInviteSignup({
    token: req.body?.token,
    email: req.body?.email,
    name: req.body?.name,
    password: req.body?.password,
  });

  res.status(201).json({ user });
});

const previewStaffInviteHandler = asyncHandler(async (req, res) => {
  const invite = await previewStaffInvite({
    token: req.query?.token,
  });
  res.json({ invite });
});

module.exports = {
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
};
