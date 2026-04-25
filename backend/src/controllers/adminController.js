const { asyncHandler } = require('../utils/asyncHandler');
const {
  createOrganizationWithOwner,
  listAllOrganizations,
  setOrganizationStatus,
  removeOrganization,
  softRemoveOrganization,
  listAllUsers,
  setUserStatus,
  resetUserPasswordAsSuperadmin,
} = require('../services/adminService');

const createOrganizationHandler = asyncHandler(async (req, res) => {
  const result = await createOrganizationWithOwner({
    actor: req.user,
    organizationName: req.body?.organizationName,
    ownerName: req.body?.ownerName,
    ownerEmail: req.body?.ownerEmail,
  });

  res.status(201).json(result);
});

const listOrganizationsHandler = asyncHandler(async (req, res) => {
  const organizations = await listAllOrganizations({ actor: req.user });
  res.json({ organizations });
});

const updateOrganizationStatusHandler = asyncHandler(async (req, res) => {
  if (typeof req.body?.is_active !== 'boolean') {
    return res.status(400).json({ message: 'is_active must be a boolean' });
  }
  const organization = await setOrganizationStatus({
    actor: req.user,
    organizationId: req.params.orgId,
    isActive: req.body?.is_active,
  });
  res.json({ organization });
});

const deleteOrganizationHandler = asyncHandler(async (req, res) => {
  await removeOrganization({ actor: req.user, organizationId: req.params.orgId });
  res.json({ success: true });
});

const softDeleteOrganizationHandler = asyncHandler(async (req, res) => {
  const organization = await softRemoveOrganization({
    actor: req.user,
    organizationId: req.params.orgId,
  });
  res.json({ organization });
});

const listUsersHandler = asyncHandler(async (req, res) => {
  const users = await listAllUsers({ actor: req.user });
  res.json({ users });
});

const updateUserStatusHandler = asyncHandler(async (req, res) => {
  if (typeof req.body?.is_active !== 'boolean') {
    return res.status(400).json({ message: 'is_active must be a boolean' });
  }
  const user = await setUserStatus({
    actor: req.user,
    userId: req.params.userId,
    isActive: req.body?.is_active,
  });
  res.json({ user });
});

const resetUserPasswordHandler = asyncHandler(async (req, res) => {
  const result = await resetUserPasswordAsSuperadmin({
    actor: req.user,
    userId: req.params.userId,
  });
  res.json(result);
});

module.exports = {
  createOrganizationHandler,
  listOrganizationsHandler,
  updateOrganizationStatusHandler,
  deleteOrganizationHandler,
  softDeleteOrganizationHandler,
  listUsersHandler,
  updateUserStatusHandler,
  resetUserPasswordHandler,
};
