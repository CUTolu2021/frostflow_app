const { HttpError } = require('../utils/httpError');
const {
  aggregateStaffStockInQuantity,
  aggregateStockInQuantity,
  findProductById,
  findReconciliationById,
  insertStaffStockIn,
  insertStockIn,
  listWindowProductIds,
  saveReconciliationWindow,
  updateProductUnit,
  updateReconciliationStatus,
} = require('../repositories/inventoryRepository');
const { markSaleVoided } = require('../repositories/salesRepository');
const { insertAuditLog } = require('../repositories/auditRepository');
const { env } = require('../config/env');

const RECON_CUTOFF_HOUR_UTC = Number.isFinite(Number(env.reconciliationCutoffHourUtc))
  ? Number(env.reconciliationCutoffHourUtc)
  : 20;

const assertRole = (user, roles) => {
  if (user.role === 'superadmin') return;
  if (!roles.includes(user.role)) {
    throw new HttpError(403, 'Insufficient permissions');
  }
};

const resolveOrganizationId = (actor, requestedOrgId) => {
  if (actor.role === 'superadmin') {
    const orgId = String(requestedOrgId || '').trim();
    if (!orgId) {
      throw new HttpError(400, 'organization_id is required');
    }
    return orgId;
  }
  if (!actor.organization_id) {
    throw new HttpError(400, 'User is missing organization context');
  }
  return actor.organization_id;
};

const toWindowDate = (input) => {
  const value = String(input || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'windowDate/logged_date must be a valid date');
  }
  return date.toISOString().slice(0, 10);
};

const deriveReconciliationStatus = ({ ownerQuantity, staffQuantity }) => {
  if (ownerQuantity === staffQuantity) return 'match';
  if (ownerQuantity > 0 && staffQuantity === 0) return 'missing_in_sales';
  if (staffQuantity > ownerQuantity) return 'extra_in_sales';
  return 'mismatch';
};

const shouldEscalate = ({ status, windowDate }) => {
  if (status === 'match' || status === 'resolved') return false;
  const cutoff = new Date(`${windowDate}T${String(RECON_CUTOFF_HOUR_UTC).padStart(2, '0')}:00:00.000Z`);
  return Date.now() >= cutoff.getTime();
};

const runReconciliationForProductWindow = async ({ organizationId, productId, windowDate }) => {
  const ownerQuantity = await aggregateStockInQuantity({
    organizationId,
    productId,
    windowDate,
  });

  const staffQuantity = await aggregateStaffStockInQuantity({
    organizationId,
    productId,
    windowDate,
  });

  const difference = ownerQuantity - staffQuantity;
  const status = deriveReconciliationStatus({ ownerQuantity, staffQuantity });
  const isEscalated = shouldEscalate({ status, windowDate });

  return saveReconciliationWindow({
    organizationId,
    productId,
    windowDate,
    ownerQuantity,
    staffQuantity,
    difference,
    status,
    isEscalated,
  });
};

const runReconciliationForWindow = async ({ actor, organizationId, windowDate }) => {
  assertRole(actor, ['admin', 'manager']);
  const orgId = resolveOrganizationId(actor, organizationId);
  const targetWindowDate = toWindowDate(windowDate);
  const productIds = await listWindowProductIds({
    organizationId: orgId,
    windowDate: targetWindowDate,
  });

  const results = [];
  for (const productId of productIds) {
    const record = await runReconciliationForProductWindow({
      organizationId: orgId,
      productId,
      windowDate: targetWindowDate,
    });
    results.push(record);
  }

  return {
    windowDate: targetWindowDate,
    totalProductsChecked: productIds.length,
    mismatchCount: results.filter((r) => r.status === 'mismatch').length,
    missingCount: results.filter((r) => r.status === 'missing_in_sales').length,
    extraCount: results.filter((r) => r.status === 'extra_in_sales').length,
    escalatedCount: results.filter((r) => r.is_escalated === true).length,
  };
};

const addStockEntry = async ({ actor, payload }) => {
  assertRole(actor, ['admin', 'manager']);
  if (!payload?.product_id) {
    throw new HttpError(400, 'product_id is required');
  }
  if (!Number.isFinite(Number(payload?.quantity)) || Number(payload.quantity) <= 0) {
    throw new HttpError(400, 'quantity must be a positive number');
  }
  const organizationId = resolveOrganizationId(actor, payload.organization_id);
  const record = await insertStockIn({
    ...payload,
    organization_id: organizationId,
    recorded_by: actor.id,
  });
  try {
    await runReconciliationForProductWindow({
      organizationId,
      productId: record.product_id,
      windowDate: toWindowDate(record.logged_date || payload?.logged_date),
    });
  } catch (error) {
    console.warn('[reconciliation] owner stock entry could not update reconciliation window:', error.message || error);
  }
  return record;
};

const addStaffStockEntry = async ({ actor, payload }) => {
  assertRole(actor, ['admin', 'manager', 'sales']);
  if (!payload?.product_id) {
    throw new HttpError(400, 'product_id is required');
  }
  if (!Number.isFinite(Number(payload?.quantity)) || Number(payload.quantity) <= 0) {
    throw new HttpError(400, 'quantity must be a positive number');
  }
  const organizationId = resolveOrganizationId(actor, payload.organization_id);
  const record = await insertStaffStockIn({
    ...payload,
    organization_id: organizationId,
    recorded_by: actor.id,
  });
  try {
    await runReconciliationForProductWindow({
      organizationId,
      productId: record.product_id,
      windowDate: toWindowDate(record.logged_date || payload?.logged_date),
    });
  } catch (error) {
    console.warn('[reconciliation] staff stock entry could not update reconciliation window:', error.message || error);
  }
  return record;
};

const voidSale = async ({ actor, saleId, productId, quantityToReturn, reason }) => {
  assertRole(actor, ['admin', 'manager']);

  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason || normalizedReason.length < 5) {
    throw new HttpError(400, 'Void reason must be at least 5 characters');
  }

  const returnQuantity = Number(quantityToReturn);
  if (!Number.isFinite(returnQuantity) || returnQuantity <= 0) {
    throw new HttpError(400, 'quantityToReturn must be a positive number');
  }

  const organizationId = resolveOrganizationId(actor);
  const product = await findProductById(productId, organizationId);
  const previousUnit = Number(product.unit || 0);
  const nextUnit = previousUnit + returnQuantity;

  await markSaleVoided({ saleId, organizationId });
  await updateProductUnit({ productId, nextUnit, organizationId });

  await insertAuditLog({
    tableName: 'sales',
    recordId: saleId,
    action: `VOID_TRANSACTION: ${normalizedReason}`,
    changedBy: actor.id,
    organizationId,
    beforeData: {
      saleId,
      productId,
      quantity: returnQuantity,
      productName: product.name,
      previousStatus: 'completed',
      previousUnit,
    },
    afterData: {
      status: 'voided',
      reason: normalizedReason,
      unit: nextUnit,
      returned_to_stock_at: new Date().toISOString(),
    },
  });
};

const resolveMismatch = async ({
  actor,
  reconciliationId,
  productId,
  finalQuantity,
  resolutionNote,
}) => {
  assertRole(actor, ['admin', 'manager']);

  const normalizedNote = String(resolutionNote || '').trim();
  if (!normalizedNote || normalizedNote.length < 3) {
    throw new HttpError(400, 'resolutionNote must be at least 3 characters');
  }

  const quantity = Number(finalQuantity);
  if (!Number.isFinite(quantity)) {
    throw new HttpError(400, 'finalQuantity must be a number');
  }

  const organizationId = resolveOrganizationId(actor);
  const reconciliation = await findReconciliationById(reconciliationId, organizationId);
  const targetProductId = productId || reconciliation.product_id;

  const product = await findProductById(targetProductId, organizationId);
  const previousUnit = Number(product.unit || 0);
  const nextUnit = previousUnit + quantity;

  await updateProductUnit({ productId: targetProductId, nextUnit, organizationId });
  await updateReconciliationStatus({ reconciliationId, status: 'resolved', organizationId });

  await insertAuditLog({
    tableName: 'reconciliation',
    recordId: reconciliationId,
    action: `RESOLVED_MISMATCH: ${normalizedNote}`,
    changedBy: actor.id,
    organizationId,
    beforeData: {
      product: product.name,
      quantity: previousUnit,
      status: reconciliation.status,
    },
    afterData: {
      product: product.name,
      quantity: nextUnit,
      status: 'resolved',
    },
  });
};

module.exports = {
  addStaffStockEntry,
  addStockEntry,
  runReconciliationForWindow,
  resolveMismatch,
  voidSale,
};
