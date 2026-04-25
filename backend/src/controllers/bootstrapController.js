const { asyncHandler } = require('../utils/asyncHandler');
const { initializeOrResetPassword } = require('../services/bootstrapService');

const bootstrapPasswordHandler = asyncHandler(async (req, res) => {
  const user = await initializeOrResetPassword({
    bootstrapToken: req.headers['x-bootstrap-token'],
    email: req.body?.email,
    password: req.body?.password,
  });

  res.json({ user });
});

module.exports = { bootstrapPasswordHandler };
