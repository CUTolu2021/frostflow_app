const { HttpError } = require('../utils/httpError');
const crypto = require('crypto');
const {
  generateRefreshToken,
  getRefreshExpiry,
  hashPassword,
  hashToken,
  issueAccessToken,
  verifyPassword,
} = require('../utils/security');
const {
  createSession,
  findActiveSessionByTokenHash,
  revokeAllSessionsForUser,
  revokeSessionById,
  rotateSessionToken,
} = require('../repositories/authSessionsRepository');
const {
  createStaffUser,
  findByEmail,
  findById,
  findRawById,
  sanitizeUser,
  updatePasswordAndResetFlag,
  updatePasswordHash,
} = require('../repositories/usersRepository');
const { getOrganizationById } = require('../repositories/organizationsRepository');
const {
  consumeInvite,
  findActiveInviteByTokenHash,
  upsertStaffInvite,
} = require('../repositories/staffInvitesRepository');
const { env } = require('../config/env');
const { sendEmail } = require('./emailService');

const DUMMY_TEST_PASSWORDS = {
  'admin1@frostflow.test': 'Admin@2026',
  'admin2@frostflow.test': 'Admin@2026',
  'manager1@frostflow.test': 'Manager@2026',
  'manager2@frostflow.test': 'Manager@2026',
  'sales1@frostflow.test': 'Sales@2026',
  'sales2@frostflow.test': 'Sales@2026',
};

const isDummyPasswordLoginAllowed = () =>
  process.env.ALLOW_DUMMY_PASSWORD_LOGIN === 'true' || process.env.NODE_ENV !== 'production';

const isValidDummyPassword = ({ email, password }) => {
  if (!isDummyPasswordLoginAllowed()) return false;
  const expected = DUMMY_TEST_PASSWORDS[String(email || '').toLowerCase()];
  return Boolean(expected && expected === password);
};

const ensureActiveUser = (dbUser) => {
  if (!dbUser || dbUser.is_active === false) {
    throw new HttpError(403, 'Account disabled');
  }
};

const createAuthResponse = async ({ user, userAgent, ipAddress }) => {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = getRefreshExpiry();

  const session = await createSession({
    userId: user.id,
    refreshTokenHash,
    expiresAt,
    userAgent,
    ipAddress,
  });

  const accessToken = issueAccessToken(user, session.id);
  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
    user,
  };
};

const login = async ({ email, password, userAgent, ipAddress }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const rawPassword = String(password || '');

  if (!normalizedEmail || !rawPassword) {
    throw new HttpError(400, 'Email and password are required');
  }

  const dbUser = await findByEmail(normalizedEmail);
  if (!dbUser) {
    throw new HttpError(401, 'Invalid email or password');
  }

  ensureActiveUser(dbUser);
  if (dbUser.role !== 'superadmin' && !dbUser.organization_id) {
    throw new HttpError(403, 'Account missing organization assignment');
  }
  if (dbUser.role !== 'superadmin' && dbUser.organization_id) {
    const org = await getOrganizationById({ organizationId: dbUser.organization_id });
    if (org.is_active === false) {
      throw new HttpError(403, 'Organization disabled');
    }
    dbUser.organization_name = org.name;
  }

  let passwordOk = false;
  if (dbUser.password_hash) {
    passwordOk = await verifyPassword(rawPassword, dbUser.password_hash);
  } else {
    passwordOk = isValidDummyPassword({
      email: dbUser.email,
      password: rawPassword,
    });
  }

  if (!passwordOk) {
    throw new HttpError(401, 'Invalid email or password');
  }

  return createAuthResponse({
    user: sanitizeUser(dbUser),
    userAgent,
    ipAddress,
  });
};

const refresh = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new HttpError(400, 'refreshToken is required');
  }

  const refreshTokenHash = hashToken(refreshToken);
  const session = await findActiveSessionByTokenHash(refreshTokenHash);
  if (!session) {
    throw new HttpError(401, 'Invalid refresh token');
  }

  if (session.is_revoked) {
    throw new HttpError(401, 'Session revoked');
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await revokeSessionById(session.id);
    throw new HttpError(401, 'Refresh token expired');
  }

  const user = await findById(session.user_id);
  if (!user || user.is_active === false) {
    await revokeSessionById(session.id);
    throw new HttpError(403, 'Account disabled');
  }
  if (user.role !== 'superadmin' && !user.organization_id) {
    await revokeSessionById(session.id);
    throw new HttpError(403, 'Account missing organization assignment');
  }
  if (user.role !== 'superadmin' && user.organization_id) {
    const org = await getOrganizationById({ organizationId: user.organization_id });
    if (org.is_active === false) {
      await revokeSessionById(session.id);
      throw new HttpError(403, 'Organization disabled');
    }
    user.organization_name = org.name;
  }

  const nextRefreshToken = generateRefreshToken();
  const nextRefreshTokenHash = hashToken(nextRefreshToken);
  const nextExpiresAt = getRefreshExpiry();

  await rotateSessionToken({
    sessionId: session.id,
    nextRefreshTokenHash,
    nextExpiresAt,
  });

  return {
    accessToken: issueAccessToken(user, session.id),
    refreshToken: nextRefreshToken,
    sessionId: session.id,
    user,
  };
};

const logout = async ({ userId, refreshToken }) => {
  if (refreshToken) {
    const refreshTokenHash = hashToken(refreshToken);
    const session = await findActiveSessionByTokenHash(refreshTokenHash);
    if (session && session.user_id === userId) {
      await revokeSessionById(session.id);
      return;
    }
  }

  await revokeAllSessionsForUser(userId);
};

const STAFF_INVITE_EXPIRY_DAYS = 7;

const createStaffInvite = async ({ actor, email, role, organizationId }) => {
  if (!['admin', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin can invite staff users');
  }

  const resolvedOrgId =
    actor.role === 'superadmin' ? String(organizationId || '').trim() : actor.organization_id;
  if (!resolvedOrgId) {
    throw new HttpError(400, 'organizationId is required');
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedRole = String(role || '').trim().toLowerCase();

  if (!normalizedEmail || !normalizedRole) {
    throw new HttpError(400, 'email and role are required');
  }
  if (!['sales', 'manager'].includes(normalizedRole)) {
    throw new HttpError(400, 'Invalid staff role');
  }

  const existing = await findByEmail(normalizedEmail);
  if (existing) {
    throw new HttpError(409, 'A user with this email already exists');
  }

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteTokenHash = hashToken(inviteToken);
  const expiresAt = new Date(Date.now() + STAFF_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const invite = await upsertStaffInvite({
    organizationId: resolvedOrgId,
    invitedEmail: normalizedEmail,
    role: normalizedRole,
    inviteTokenHash,
    expiresAt,
    createdBy: actor.id,
  });

  const baseUrl = env.frontendUrl || 'http://localhost:4200';
  const inviteLink = `${baseUrl}/staff-signup?token=${inviteToken}`;
  const org = await getOrganizationById({ organizationId: resolvedOrgId });

  const emailText = `You have been invited to join ${org.name} on Frostflow.\n\nRole: ${normalizedRole}\nEmail: ${normalizedEmail}\nInvite link: ${inviteLink}\nExpires: ${new Date(invite.expires_at).toISOString()}\n\nOpen the link and complete your signup with this same email address.`;
  const emailHtml = `
    <p>You have been invited to join <strong>${org.name}</strong> on Frostflow.</p>
    <p><strong>Role:</strong> ${normalizedRole}</p>
    <p><strong>Email:</strong> ${normalizedEmail}</p>
    <p><a href="${inviteLink}">Complete your signup</a></p>
    <p><strong>Expires:</strong> ${new Date(invite.expires_at).toISOString()}</p>
    <p>Open the link and complete your signup with this same email address.</p>
  `;

  let emailStatus = { sent: false, skipped: false, error: null };
  try {
    const result = await sendEmail({
      to: normalizedEmail,
      subject: `Frostflow invite: ${org.name}`,
      text: emailText,
      html: emailHtml,
    });
    emailStatus = {
      sent: result?.skipped !== true,
      skipped: result?.skipped === true,
      error: null,
    };
  } catch (error) {
    emailStatus = { sent: false, skipped: false, error: error?.message || 'Email send failed' };
    console.warn(`[email] staff invite mail failed for ${normalizedEmail}: ${emailStatus.error}`);
  }

  return {
    inviteId: invite.id,
    inviteLink,
    invitedEmail: normalizedEmail,
    role: normalizedRole,
    expiresAt: invite.expires_at,
    emailStatus,
  };
};

const registerStaff = async ({ actor, name, email, password, role, organizationId }) => {
  if (actor.role !== 'superadmin') {
    throw new HttpError(403, 'Direct staff creation is superadmin-only. Admins must use invite flow.');
  }

  const resolvedOrgId =
    actor.role === 'superadmin' ? String(organizationId || '').trim() : actor.organization_id;

  if (!resolvedOrgId) {
    throw new HttpError(400, 'organizationId is required');
  }

  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedRole = String(role || '').trim();
  const rawPassword = String(password || '');

  if (!normalizedName || !normalizedEmail || !normalizedRole || !rawPassword) {
    throw new HttpError(400, 'name, email, role and password are required');
  }

  if (!['sales', 'manager'].includes(normalizedRole)) {
    throw new HttpError(400, 'Invalid staff role');
  }

  if (rawPassword.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

const passwordHash = await hashPassword(rawPassword);
  return createStaffUser({
    name: normalizedName,
    email: normalizedEmail,
    role: normalizedRole,
    passwordHash,
    organizationId: resolvedOrgId,
    mustResetPassword: true,
  });
};

const resetUserPassword = async ({ actor, userId, nextPassword }) => {
  if (!['admin', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin can reset passwords');
  }

  const rawPassword = String(nextPassword || '');
  if (rawPassword.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

  if (actor.role !== 'superadmin') {
    const targetUser = await findRawById(userId);
    if (!targetUser) {
      throw new HttpError(404, 'User not found');
    }
    if (targetUser.organization_id !== actor.organization_id) {
      throw new HttpError(403, 'Cannot reset password for a different organization');
    }
  }

  const passwordHash = await hashPassword(rawPassword);
  const user = await updatePasswordAndResetFlag({
    userId,
    passwordHash,
    mustResetPassword: true,
  });
  await revokeAllSessionsForUser(user.id);
  return user;
};

const completeStaffInviteSignup = async ({ token, email, name, password }) => {
  const inviteToken = String(token || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedName = String(name || '').trim();
  const rawPassword = String(password || '');

  if (!inviteToken || !normalizedEmail || !normalizedName || !rawPassword) {
    throw new HttpError(400, 'token, email, name and password are required');
  }
  if (rawPassword.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

  const inviteTokenHash = hashToken(inviteToken);
  const invite = await findActiveInviteByTokenHash({ inviteTokenHash });
  if (!invite) {
    throw new HttpError(400, 'Invalid or already used invite');
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new HttpError(400, 'Invite link has expired');
  }
  if (normalizedEmail !== String(invite.invited_email || '').toLowerCase()) {
    throw new HttpError(400, 'Email must match the invited email');
  }

  const org = await getOrganizationById({ organizationId: invite.organization_id });
  if (!org.is_active || org.deleted_at) {
    throw new HttpError(403, 'Organization is not active');
  }

  const existing = await findByEmail(normalizedEmail);
  if (existing) {
    throw new HttpError(409, 'A user with this email already exists');
  }

  const passwordHash = await hashPassword(rawPassword);
  const user = await createStaffUser({
    name: normalizedName,
    email: normalizedEmail,
    role: invite.role,
    passwordHash,
    organizationId: invite.organization_id,
    mustResetPassword: false,
  });

  await consumeInvite({ inviteId: invite.id, usedBy: user.id });
  return user;
};

const previewStaffInvite = async ({ token }) => {
  const inviteToken = String(token || '').trim();
  if (!inviteToken) {
    throw new HttpError(400, 'token is required');
  }

  const inviteTokenHash = hashToken(inviteToken);
  const invite = await findActiveInviteByTokenHash({ inviteTokenHash });
  if (!invite) {
    throw new HttpError(404, 'Invite not found');
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new HttpError(400, 'Invite link has expired');
  }

  return {
    invitedEmail: invite.invited_email,
    role: invite.role,
    expiresAt: invite.expires_at,
  };
};

const changeOwnPassword = async ({ actor, currentPassword, nextPassword }) => {
  const rawCurrent = String(currentPassword || '');
  const rawNext = String(nextPassword || '');

  if (!rawCurrent || !rawNext) {
    throw new HttpError(400, 'currentPassword and nextPassword are required');
  }

  if (rawNext.length < 8) {
    throw new HttpError(400, 'Password must be at least 8 characters');
  }

  const dbUser = await findByEmail(String(actor.email || '').trim().toLowerCase());
  if (!dbUser || !dbUser.password_hash) {
    throw new HttpError(401, 'Invalid current password');
  }

  const ok = await verifyPassword(rawCurrent, dbUser.password_hash);
  if (!ok) {
    throw new HttpError(401, 'Invalid current password');
  }

  const passwordHash = await hashPassword(rawNext);
  const user = await updatePasswordAndResetFlag({
    userId: actor.id,
    passwordHash,
    mustResetPassword: false,
  });

  await revokeAllSessionsForUser(actor.id);
  return user;
};

module.exports = {
  completeStaffInviteSignup,
  createStaffInvite,
  login,
  logout,
  refresh,
  registerStaff,
  resetUserPassword,
  changeOwnPassword,
  previewStaffInvite,
};
