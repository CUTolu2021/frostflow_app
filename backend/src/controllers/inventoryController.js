const { asyncHandler } = require('../utils/asyncHandler');
const {
  addStaffStockEntry,
  addStockEntry,
  recordDailySale,
  runReconciliationForWindow,
  resolveMismatch,
  voidSale,
} = require('../services/inventoryService');

const addStockEntryHandler = asyncHandler(async (req, res) => {
  const record = await addStockEntry({
    actor: req.user,
    payload: req.body,
  });
  res.status(201).json({ record });
});

const addStaffStockEntryHandler = asyncHandler(async (req, res) => {
  const record = await addStaffStockEntry({
    actor: req.user,
    payload: req.body,
  });
  res.status(201).json({ record });
});

const recordDailySaleHandler = asyncHandler(async (req, res) => {
  const sale = await recordDailySale({
    actor: req.user,
    payload: req.body,
  });

  res.status(201).json({ sale });
});

const voidSaleHandler = asyncHandler(async (req, res) => {
  await voidSale({
    actor: req.user,
    saleId: req.body?.saleId,
    productId: req.body?.productId,
    quantityToReturn: req.body?.quantityToReturn,
    reason: req.body?.reason,
  });

  res.json({ success: true });
});

const resolveMismatchHandler = asyncHandler(async (req, res) => {
  await resolveMismatch({
    actor: req.user,
    reconciliationId: req.body?.reconciliationId,
    productId: req.body?.productId,
    finalQuantity: req.body?.finalQuantity,
    resolutionNote: req.body?.resolutionNote,
  });

  res.json({ success: true });
});

const runReconciliationHandler = asyncHandler(async (req, res) => {
  const summary = await runReconciliationForWindow({
    actor: req.user,
    organizationId: req.body?.organization_id,
    windowDate: req.body?.windowDate,
  });

  res.json({ summary });
});

module.exports = {
  addStaffStockEntryHandler,
  addStockEntryHandler,
  recordDailySaleHandler,
  runReconciliationHandler,
  resolveMismatchHandler,
  voidSaleHandler,
};
