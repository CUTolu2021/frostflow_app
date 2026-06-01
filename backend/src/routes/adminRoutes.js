const { Router } = require('express');
const { requireAuth } = require('../middlewares/authMiddleware');
const {
  createOrganizationHandler,
  deleteOrganizationHandler,
  listOrganizationsHandler,
  listUsersHandler,
  resetUserPasswordHandler,
  softDeleteOrganizationHandler,
  updateOrganizationInventoryModeHandler,
  updateOrganizationStatusHandler,
  updateUserStatusHandler,
} = require('../controllers/adminController');

const router = Router();

router.use(requireAuth);
router.get('/organizations', listOrganizationsHandler);
router.post('/organizations', createOrganizationHandler);
router.patch('/organizations/:orgId/active', updateOrganizationStatusHandler);
router.patch('/organizations/:orgId/inventory-mode', updateOrganizationInventoryModeHandler);
router.post('/organizations/:orgId/soft-delete', softDeleteOrganizationHandler);
router.delete('/organizations/:orgId', deleteOrganizationHandler);

router.get('/users', listUsersHandler);
router.patch('/users/:userId/active', updateUserStatusHandler);
router.post('/users/:userId/reset-password', resetUserPasswordHandler);

module.exports = { adminRoutes: router };
