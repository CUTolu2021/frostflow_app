const { asyncHandler } = require('../utils/asyncHandler');
const {
  archiveProduct,
  createExpense,
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
  getOrganizationSettings,
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
  updateOrganizationSettings,
} = require('../services/appService');

const getProfileHandler = asyncHandler(async (req, res) => {
  const profile = await getProfile({
    actor: req.user,
    userId: req.params.userId,
    organizationId: req.query.organizationId,
  });
  res.json({ profile });
});

const listProductsHandler = asyncHandler(async (req, res) => {
  const products = await getAllProducts({ actor: req.user, organizationId: req.query.organizationId });
  res.json({ products });
});

const getProductHandler = asyncHandler(async (req, res) => {
  const product = await getSingleProduct({
    actor: req.user,
    organizationId: req.query.organizationId,
    productId: req.params.productId,
  });
  res.json({ product });
});

const createProductHandler = asyncHandler(async (req, res) => {
  const product = await createProduct({
    actor: req.user,
    organizationId: req.body?.organizationId,
    payload: req.body,
  });
  res.status(201).json({ product });
});

const updateProductHandler = asyncHandler(async (req, res) => {
  const product = await editProduct({
    actor: req.user,
    organizationId: req.body?.organizationId,
    productId: req.params.productId,
    updates: req.body,
  });
  res.json({ product });
});

const archiveProductHandler = asyncHandler(async (req, res) => {
  const product = await archiveProduct({
    actor: req.user,
    organizationId: req.body?.organizationId || req.query.organizationId,
    productId: req.params.productId,
  });
  res.json({ product });
});

const listAiReportsHandler = asyncHandler(async (req, res) => {
  const reports = await getAiReports({
    actor: req.user,
    organizationId: req.query.organizationId,
    limit: Number(req.query.limit || 1),
  });
  res.json({ reports });
});

const listPendingMismatchesHandler = asyncHandler(async (req, res) => {
  const mismatches = await getPendingReconciliations({
    actor: req.user,
    organizationId: req.query.organizationId,
  });
  res.json({ mismatches });
});

const getDashboardMetricsHandler = asyncHandler(async (req, res) => {
  const metrics = await getDashboardMetrics({ actor: req.user, organizationId: req.query.organizationId });
  res.json(metrics);
});

const getSalesDashboardMetricsHandler = asyncHandler(async (req, res) => {
  const metrics = await getSalesDashboardMetrics({
    actor: req.user,
    organizationId: req.query.organizationId,
  });
  res.json(metrics);
});

const getTodaySalesMetricsHandler = asyncHandler(async (req, res) => {
  const metrics = await getTodaySalesMetrics({
    actor: req.user,
    organizationId: req.query.organizationId,
  });
  res.json(metrics);
});

const getChartDataHandler = asyncHandler(async (req, res) => {
  const chart = await getChartData({ actor: req.user, organizationId: req.query.organizationId });
  res.json({ chart });
});

const listNotificationsHandler = asyncHandler(async (req, res) => {
  const notifications = await getUnreadNotifications({
    actor: req.user,
    organizationId: req.query.organizationId,
  });
  res.json({ notifications });
});

const markNotificationReadHandler = asyncHandler(async (req, res) => {
  await markNotificationRead({
    actor: req.user,
    organizationId: req.body?.organizationId || req.query.organizationId,
    notificationId: req.params.notificationId,
  });
  res.json({ success: true });
});

const getDailyEntryStatusHandler = asyncHandler(async (req, res) => {
  const status = await getDailyEntryStatus({ actor: req.user, organizationId: req.query.organizationId });
  res.json(status);
});

const listInventoryLogsHandler = asyncHandler(async (req, res) => {
  const logs = await getInventoryLogs({ actor: req.user, organizationId: req.query.organizationId });
  res.json({ logs });
});

const getProductHistoryHandler = asyncHandler(async (req, res) => {
  const history = await getProductHistory({
    actor: req.user,
    organizationId: req.query.organizationId,
    productId: req.params.productId,
  });
  res.json({ history });
});

const listStaffHandler = asyncHandler(async (req, res) => {
  const staff = await getStaffList({ actor: req.user, organizationId: req.query.organizationId });
  res.json({ staff });
});

const updateStaffStatusHandler = asyncHandler(async (req, res) => {
  if (typeof req.body?.is_active !== 'boolean') {
    return res.status(400).json({ message: 'is_active must be a boolean' });
  }
  await setStaffStatus({
    actor: req.user,
    organizationId: req.body?.organizationId,
    userId: req.params.userId,
    isActive: req.body.is_active,
  });
  res.json({ success: true });
});

const listRecentSalesHandler = asyncHandler(async (req, res) => {
  const sales = await getRecentSales({ actor: req.user, organizationId: req.query.organizationId });
  res.json({ sales });
});

const listRecentStaffEntriesHandler = asyncHandler(async (req, res) => {
  const entries = await getRecentStaffEntries({ actor: req.user, organizationId: req.query.organizationId });
  res.json({ entries });
});

const listSalesHistoryHandler = asyncHandler(async (req, res) => {
  const sales = await getSalesHistory({
    actor: req.user,
    organizationId: req.query.organizationId,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  res.json({ sales });
});

const listExpensesHandler = asyncHandler(async (req, res) => {
  const expenses = await getExpenses({
    actor: req.user,
    organizationId: req.query.organizationId,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });
  res.json({ expenses });
});

const createExpenseHandler = asyncHandler(async (req, res) => {
  const expense = await createExpense({
    actor: req.user,
    organizationId: req.body?.organizationId,
    payload: req.body,
  });
  res.status(201).json({ expense });
});

const getOrganizationSettingsHandler = asyncHandler(async (req, res) => {
  const settings = await getOrganizationSettings({
    actor: req.user,
    organizationId: req.query.organizationId,
  });
  res.json({ settings });
});

const updateOrganizationSettingsHandler = asyncHandler(async (req, res) => {
  const inventoryMode = String(req.body?.inventory_mode || '').trim().toLowerCase();
  if (!inventoryMode) {
    return res.status(400).json({ message: 'inventory_mode is required' });
  }

  if (!['dual_control', 'single_operator'].includes(inventoryMode)) {
    return res.status(400).json({ message: 'inventory_mode must be dual_control or single_operator' });
  }

  const settings = await updateOrganizationSettings({
    actor: req.user,
    organizationId: req.body?.organizationId || req.query.organizationId,
    inventoryMode,
  });
  res.json({ settings });
});

module.exports = {
  archiveProductHandler,
  createProductHandler,
  createExpenseHandler,
  getChartDataHandler,
  getDailyEntryStatusHandler,
  getDashboardMetricsHandler,
  getProductHandler,
  getProductHistoryHandler,
  getProfileHandler,
  getSalesDashboardMetricsHandler,
  getTodaySalesMetricsHandler,
  listAiReportsHandler,
  listExpensesHandler,
  listInventoryLogsHandler,
  listNotificationsHandler,
  getOrganizationSettingsHandler,
  listPendingMismatchesHandler,
  listProductsHandler,
  listRecentSalesHandler,
  listRecentStaffEntriesHandler,
  listSalesHistoryHandler,
  listStaffHandler,
  markNotificationReadHandler,
  updateProductHandler,
  updateOrganizationSettingsHandler,
  updateStaffStatusHandler,
};
