const { HttpError } = require('../utils/httpError');
const { hashPassword, generateTempPassword } = require('../utils/security');
const {
  createOrganization,
  deleteOrganization,
  deleteOrganizationCascade,
  listOrganizations,
  softDeleteOrganization,
  updateOrganizationStatus,
  countUsersByOrg,
} = require('../repositories/organizationsRepository');
const { createUser } = require('../repositories/usersRepository');
const { listUsers, updateUserStatus, updateUserPassword } = require('../repositories/adminRepository');
const { sendEmail } = require('./emailService');
const { env } = require('../config/env');

const assertSuperadmin = (actor) => {
  if (actor.role !== 'superadmin') {
    throw new HttpError(403, 'Only superadmin can perform this action');
  }
};

const createOrganizationWithOwner = async ({ actor, organizationName, ownerName, ownerEmail }) => {
  assertSuperadmin(actor);

  const normalizedOrgName = String(organizationName || '').trim();
  const normalizedOwnerName = String(ownerName || '').trim();
  const normalizedOwnerEmail = String(ownerEmail || '').trim().toLowerCase();
  const rawPassword = generateTempPassword();

  if (!normalizedOrgName || !normalizedOwnerName || !normalizedOwnerEmail) {
    throw new HttpError(400, 'organizationName, ownerName and ownerEmail are required');
  }

  const organization = await createOrganization({ name: normalizedOrgName });
  const passwordHash = await hashPassword(rawPassword);

  const owner = await createUser({
    name: normalizedOwnerName,
    email: normalizedOwnerEmail,
    role: 'admin',
    passwordHash,
    organizationId: organization.id,
    mustResetPassword: true,
  });

  const loginUrl = env.frontendUrl ? `${env.frontendUrl}/login` : 'the app login page';
  const emailText = `Your organization has been created.\n\nOrganization: ${organization.name}\nLogin: ${normalizedOwnerEmail}\nTemporary password: ${rawPassword}\n\nLog in here: ${loginUrl}\nYou will be asked to change your password on first login.`;
  const emailHtml = `
    <p>Your organization has been created.</p>
    <p><strong>Organization:</strong> ${organization.name}</p>
    <p><strong>Login:</strong> ${normalizedOwnerEmail}</p>
    <p><strong>Temporary password:</strong> ${rawPassword}</p>
    <p>Log in here: ${loginUrl}</p>
    <p>You will be asked to change your password on first login.</p>
  `;

  let emailStatus = { sent: false, skipped: false, error: null };
  try {
    const result = await sendEmail({
      to: normalizedOwnerEmail,
      subject: 'Your Frostflow organization is ready',
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
    console.warn(`[email] owner onboarding mail failed for ${normalizedOwnerEmail}: ${emailStatus.error}`);
  }

  return { organization, owner, tempPassword: rawPassword, emailStatus };
};

const listAllOrganizations = async ({ actor }) => {
  assertSuperadmin(actor);
  return listOrganizations();
};

const setOrganizationStatus = async ({ actor, organizationId, isActive }) => {
  assertSuperadmin(actor);
  if (typeof isActive !== 'boolean') {
    throw new HttpError(400, 'isActive must be a boolean');
  }
  return updateOrganizationStatus({ organizationId, isActive });
};

const removeOrganization = async ({ actor, organizationId }) => {
  assertSuperadmin(actor);
  await deleteOrganizationCascade({ organizationId });
};

const softRemoveOrganization = async ({ actor, organizationId }) => {
  assertSuperadmin(actor);
  return softDeleteOrganization({ organizationId });
};

const listAllUsers = async ({ actor }) => {
  assertSuperadmin(actor);
  return listUsers();
};

const setUserStatus = async ({ actor, userId, isActive }) => {
  assertSuperadmin(actor);
  if (typeof isActive !== 'boolean') {
    throw new HttpError(400, 'isActive must be a boolean');
  }
  return updateUserStatus({ userId, isActive });
};

const resetUserPasswordAsSuperadmin = async ({ actor, userId }) => {
  assertSuperadmin(actor);
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await updateUserPassword({
    userId,
    passwordHash,
    mustResetPassword: true,
  });

  const loginUrl = env.frontendUrl ? `${env.frontendUrl}/login` : 'the app login page';
  const emailText = `Your password has been reset.\n\nLogin: ${user.email}\nTemporary password: ${tempPassword}\n\nLog in here: ${loginUrl}\nYou will be asked to change your password on first login.`;
  const emailHtml = `
    <p>Your password has been reset.</p>
    <p><strong>Login:</strong> ${user.email}</p>
    <p><strong>Temporary password:</strong> ${tempPassword}</p>
    <p>Log in here: ${loginUrl}</p>
    <p>You will be asked to change your password on first login.</p>
  `;

  let emailStatus = { sent: false, skipped: false, error: null };
  try {
    const result = await sendEmail({
      to: user.email,
      subject: 'Your Frostflow password reset',
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
    console.warn(`[email] password reset mail failed for ${user.email}: ${emailStatus.error}`);
  }

  return { user, tempPassword, emailStatus };
};

module.exports = {
  createOrganizationWithOwner,
  listAllOrganizations,
  setOrganizationStatus,
  removeOrganization,
  softRemoveOrganization,
  listAllUsers,
  setUserStatus,
  resetUserPasswordAsSuperadmin,
};
