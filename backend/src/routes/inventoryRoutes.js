const { Router } = require('express');
const {
  addStaffStockEntryHandler,
  addStockEntryHandler,
  recordDailySaleHandler,
  runReconciliationHandler,
  resolveMismatchHandler,
  voidSaleHandler,
} = require('../controllers/inventoryController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { writeLimiter } = require('../middlewares/rateLimitMiddleware');

const router = Router();

router.use(requireAuth);
router.use(writeLimiter);

router.post('/stock-in', addStockEntryHandler);
router.post('/staff-stock-in', addStaffStockEntryHandler);
router.post('/sales/record', recordDailySaleHandler);
router.post('/sales/void', voidSaleHandler);
router.post('/reconciliation/resolve', resolveMismatchHandler);
router.post('/reconciliation/run', runReconciliationHandler);

module.exports = { inventoryRoutes: router };
