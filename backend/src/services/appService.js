const { HttpError } = require('../utils/httpError');
const {
  getProduct,
  getUserProfileById,
  getUserProfile,
  insertProduct,
  listAiReports,
  listChartProducts,
  countDailyEntries,
  listExpenses,
  listInventoryLogs,
  listNotifications,
  listPendingMismatches,
  listProductHistory,
  listProductUnits,
  listProducts,
  listRecentSales,
  listRecentStaffEntries,
  listSalesHistory,
  listSalesMetrics,
  listStaff,
  markNotificationRead: markNotificationReadRepo,
  updateProduct,
  updateStaffStatus,
} = require('../repositories/appRepository');
const { insertAuditLog } = require('../repositories/auditRepository');

const resolveOrganizationId = (actor, requestedOrgId) => {
  if (actor.role === 'superadmin') {
    const orgId = String(requestedOrgId || '').trim();
    if (!orgId) {
      throw new HttpError(400, 'organizationId is required');
    }
    return orgId;
  }
  if (!actor.organization_id) {
    throw new HttpError(400, 'User is missing organization context');
  }
  return actor.organization_id;
};

const getProfile = async ({ actor, userId, organizationId }) => {
  if (actor.role === 'superadmin' && !organizationId) {
    return getUserProfileById({ userId });
  }
  const orgId = resolveOrganizationId(actor, organizationId);
  return getUserProfile({ organizationId: orgId, userId });
};

const getAllProducts = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listProducts({ organizationId: orgId });
};

const getSingleProduct = async ({ actor, organizationId, productId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return getProduct({ organizationId: orgId, productId });
};

const createProduct = async ({ actor, organizationId, payload }) => {
  if (!['admin', 'manager', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin or manager can create products');
  }
  const orgId = resolveOrganizationId(actor, organizationId);
  const { organization_id: _ignored, ...safePayload } = payload || {};
  const record = await insertProduct({ organizationId: orgId, payload: safePayload });
  await insertAuditLog({
    tableName: 'products',
    recordId: record.id,
    action: `Created Product: ${record.name}`,
    changedBy: actor.id,
    organizationId: orgId,
    beforeData: null,
    afterData: record,
  });
  return record;
};

const editProduct = async ({ actor, organizationId, productId, updates }) => {
  if (!['admin', 'manager', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin or manager can update products');
  }
  const orgId = resolveOrganizationId(actor, organizationId);
  const before = await getProduct({ organizationId: orgId, productId });
  const { organization_id: _ignored, ...safeUpdates } = updates || {};
  const record = await updateProduct({ organizationId: orgId, productId, updates: safeUpdates });
  await insertAuditLog({
    tableName: 'products',
    recordId: record.id,
    action: `Edited Product: ${before.name}`,
    changedBy: actor.id,
    organizationId: orgId,
    beforeData: before,
    afterData: record,
  });
  return record;
};

const archiveProduct = async ({ actor, organizationId, productId }) => {
  if (!['admin', 'manager', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin or manager can archive products');
  }
  const orgId = resolveOrganizationId(actor, organizationId);
  const before = await getProduct({ organizationId: orgId, productId });
  const record = await updateProduct({ organizationId: orgId, productId, updates: { is_active: false } });
  await insertAuditLog({
    tableName: 'products',
    recordId: record.id,
    action: `Archived Product: ${before.name}`,
    changedBy: actor.id,
    organizationId: orgId,
    beforeData: before,
    afterData: record,
  });
  return record;
};

const getAiReports = async ({ actor, organizationId, limit }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listAiReports({ organizationId: orgId, limit });
};

const getPendingReconciliations = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listPendingMismatches({ organizationId: orgId });
};

const getDashboardMetrics = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const products = await listProductUnits({ organizationId: orgId });
  const totalValue = products.reduce((sum, item) => sum + item.unit * item.unit_price, 0);
  const lowStock = products.filter((item) => item.unit < 10).length;
  return {
    totalValue,
    lowStock,
    totalItems: products.length,
  };
};

const getSalesDashboardMetrics = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const sales = await listSalesMetrics({ organizationId: orgId });
  const totalSalesValue = sales.reduce((sum, item) => sum + item.total_price, 0);
  const totalUnitsSold = sales.reduce((sum, item) => sum + item.quantity, 0);
  return { totalSalesValue, totalUnitsSold };
};

const getTodaySalesMetrics = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const todayStartISO = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
  const sales = await listSalesMetrics({
    organizationId: orgId,
    startDate: todayStartISO,
    endDate: new Date().toISOString(),
  });
  const todaySalesValue = sales.reduce((sum, item) => sum + item.total_price, 0);
  const todayUnitsSold = sales.reduce((sum, item) => sum + item.quantity, 0);
  return { todaySalesValue, todayUnitsSold };
};

const getChartData = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const data = await listChartProducts({ organizationId: orgId, limit: 10 });
  return data.map((product) => ({
    name: product.name,
    current_balance: product.unit,
    total_sold: (product.sales || []).reduce((sum, sale) => sum + (sale.quantity || 0), 0),
  }));
};

const getUnreadNotifications = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listNotifications({ organizationId: orgId, unreadOnly: true });
};

const markNotificationRead = async ({ actor, organizationId, notificationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  await markNotificationReadRepo({ organizationId: orgId, notificationId });
};

const getDailyEntryStatus = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const today = new Date().toISOString().split('T')[0];
  const { ownerCount, salesCount } = await countDailyEntries({
    organizationId: orgId,
    sinceDate: today,
  });
  return {
    ownerReady: ownerCount > 0,
    salesReady: salesCount > 0,
  };
};

const getInventoryLogs = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listInventoryLogs({ organizationId: orgId });
};

const getProductHistory = async ({ actor, organizationId, productId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const { stockIn, stockOut } = await listProductHistory({ organizationId: orgId, productId });

  const history = [
    ...stockIn.map((item) => ({
      id: item.id,
      date: item.created_at,
      type: 'IN',
      quantity: item.quantity,
      unit: item.unit_type,
      original_qty: item.input_quantity,
      original_unit: item.input_unit,
      note: item.reference_note || 'Stock Added',
    })),
    ...stockOut.map((item) => ({
      id: item.id,
      date: item.created_at,
      type: 'OUT',
      quantity: item.quantity,
      unit: item.unit_type,
      note: `Sold via ${item.payment_method}`,
    })),
  ];

  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const getStaffList = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listStaff({ organizationId: orgId });
};

const setStaffStatus = async ({ actor, organizationId, userId, isActive }) => {
  if (!['admin', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin can update staff status');
  }
  const orgId = resolveOrganizationId(actor, organizationId);
  await updateStaffStatus({ organizationId: orgId, userId, isActive });
};

const getRecentSales = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listRecentSales({ organizationId: orgId });
};

const getRecentStaffEntries = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listRecentStaffEntries({ organizationId: orgId });
};

const getSalesHistory = async ({ actor, organizationId, startDate, endDate }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  if (!startDate || !endDate) {
    throw new HttpError(400, 'startDate and endDate are required');
  }
  return listSalesHistory({ organizationId: orgId, startDate, endDate });
};

const getExpenses = async ({ actor, organizationId, startDate, endDate }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  if (!startDate || !endDate) {
    throw new HttpError(400, 'startDate and endDate are required');
  }
  return listExpenses({ organizationId: orgId, startDate, endDate });
};

module.exports = {
  archiveProduct,
  createProduct,
  editProduct,
  getAiReports,
  getAllProducts,
  getChartData,
  getDashboardMetrics,
  getDailyEntryStatus,
  getExpenses,
  getInventoryLogs,
  getPendingReconciliations,
  getProductHistory,
  getRecentSales,
  getRecentStaffEntries,
  getSalesDashboardMetrics,
  getSalesHistory,
  getSingleProduct,
  getStaffList,
  getTodaySalesMetrics,
  getUnreadNotifications,
  getProfile,
  markNotificationRead,
  setStaffStatus,
};
