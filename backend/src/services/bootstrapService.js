const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');
const { hashPassword } = require('../utils/security');
const { findIdByEmail, updatePasswordHash } = require('../repositories/usersRepository');
const { revokeAllSessionsForUser } = require('../repositories/authSessionsRepository');

const initializeOrResetPassword = async ({ bootstrapToken, email, password }) => {
  if (!env.bootstrapAdminToken) {
    throw new HttpError(403, 'BOOTSTRAP_ADMIN_TOKEN is not configured');
  }

  if (bootstrapToken !== env.bootstrapAdminToken) {
    throw new HttpError(403, 'Invalid bootstrap token');
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');

  if (!normalizedEmail || !rawPassword) {
    throw new HttpError(400, 'email and password are required');
  }

  if (rawPassword.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

  const userId = await findIdByEmail(normalizedEmail);
  if (!userId) {
    throw new HttpError(404, 'User not found');
  }

  const passwordHash = await hashPassword(rawPassword);
  const updatedUser = await updatePasswordHash({ userId, passwordHash });
  await revokeAllSessionsForUser(userId);

  return updatedUser;
};

module.exports = { initializeOrResetPassword };
