const { Router } = require('express');
const { requireAuth } = require('../middlewares/authMiddleware');
const {
  archiveProductHandler,
  createProductHandler,
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
  listPendingMismatchesHandler,
  listProductsHandler,
  listRecentSalesHandler,
  listRecentStaffEntriesHandler,
  listSalesHistoryHandler,
  listStaffHandler,
  markNotificationReadHandler,
  updateProductHandler,
  updateStaffStatusHandler,
} = require('../controllers/appController');

const router = Router();

router.use(requireAuth);

router.get('/users/staff', listStaffHandler);
router.get('/users/:userId', getProfileHandler);
router.patch('/users/:userId/active', updateStaffStatusHandler);

router.get('/products', listProductsHandler);
router.post('/products', createProductHandler);
router.get('/products/:productId', getProductHandler);
router.patch('/products/:productId', updateProductHandler);
router.delete('/products/:productId', archiveProductHandler);
router.get('/products/:productId/history', getProductHistoryHandler);

router.get('/ai-reports', listAiReportsHandler);
router.get('/reconciliation/pending', listPendingMismatchesHandler);

router.get('/metrics/dashboard', getDashboardMetricsHandler);
router.get('/metrics/sales', getSalesDashboardMetricsHandler);
router.get('/metrics/sales/today', getTodaySalesMetricsHandler);
router.get('/metrics/chart', getChartDataHandler);
router.get('/metrics/daily-entry-status', getDailyEntryStatusHandler);

router.get('/notifications', listNotificationsHandler);
router.patch('/notifications/:notificationId/read', markNotificationReadHandler);

router.get('/inventory/logs', listInventoryLogsHandler);
router.get('/sales/recent', listRecentSalesHandler);
router.get('/staff-stock/recent', listRecentStaffEntriesHandler);
router.get('/sales/history', listSalesHistoryHandler);
router.get('/expenses', listExpensesHandler);

module.exports = { appRoutes: router };
