const { HttpError } = require('../utils/httpError');
const {
  aggregateStaffStockInQuantity,
  aggregateStaffStockInQuantityBySession,
  aggregateStockInQuantity,
  aggregateStockInQuantityBySession,
  createDeliverySession,
  findDeliverySessionById,
  findLatestOwnerStockEntryForSession,
  findOpenDeliverySessionForProduct,
  findProductById,
  findReconciliationById,
  insertStaffStockIn,
  insertStockIn,
  listActiveDeliverySessionsUpToWindow,
  listWindowProductIds,
  saveReconciliationWindow,
  updateDeliverySessionInventoryApplied,
  updateDeliverySessionState,
  updateProductUnit,
  updateReconciliationStatus,
} = require('../repositories/inventoryRepository');
const { markSaleVoided } = require('../repositories/salesRepository');
const { insertAuditLog } = require('../repositories/auditRepository');
const { env } = require('../config/env');

const RECON_CUTOFF_HOUR_UTC = Number.isFinite(Number(env.reconciliationCutoffHourUtc))
  ? Number(env.reconciliationCutoffHourUtc)
  : 20;
const DEFAULT_GRACE_HOURS = Number.isFinite(Number(env.reconciliationDefaultGraceHours))
  ? Math.max(1, Number(env.reconciliationDefaultGraceHours))
  : 24;

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

const toIsoTimestamp = (input, fieldName) => {
  const date = new Date(String(input || '').trim());
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${fieldName} must be a valid datetime`);
  }
  return date.toISOString();
};

const addHours = (isoString, hours) => {
  const base = new Date(isoString);
  return new Date(base.getTime() + (hours * 60 * 60 * 1000)).toISOString();
};

const normalizeTimePart = (timeValue) => {
  const raw = String(timeValue || '').trim();
  if (!raw) return '12:00:00';
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  throw new HttpError(400, 'arrival_time must use HH:MM or HH:MM:SS');
};

const isDeliverySessionMigrationError = (error) =>
  error instanceof HttpError
  && error.statusCode === 400
  && String(error.message || '').includes('011_delivery_sessions.sql');

const stripSessionOnlyFields = (payload) => {
  if (!payload || typeof payload !== 'object') return {};
  const {
    delivery_session_id,
    deliverySessionId,
    expected_arrival_at,
    expectedArrivalAt,
    eta,
    arrival_date,
    arrivalDate,
    arrival_time,
    arrivalTime,
    grace_until,
    graceUntil,
    ...rest
  } = payload;
  return rest;
};

const deriveReconciliationStatus = ({ ownerQuantity, staffQuantity }) => {
  if (ownerQuantity === staffQuantity) return 'match';
  if (ownerQuantity > 0 && staffQuantity === 0) return 'missing_in_sales';
  if (staffQuantity > ownerQuantity) return 'extra_in_sales';
  return 'mismatch';
};

const deriveDeliverySessionStatus = ({ ownerQuantity, staffQuantity }) => {
  if (ownerQuantity === 0 && staffQuantity === 0) return 'in_transit';
  if (ownerQuantity > 0 && ownerQuantity === staffQuantity) return 'received';
  if (ownerQuantity > 0 && staffQuantity === 0) return 'in_transit';
  if (staffQuantity > 0 && staffQuantity < ownerQuantity) return 'partially_received';
  return 'exception';
};

const shouldEscalate = ({ status, windowDate, graceUntil }) => {
  if (status === 'match' || status === 'resolved') return false;

  const graceRaw = String(graceUntil || '').trim();
  if (graceRaw) {
    const graceDate = new Date(graceRaw);
    if (!Number.isNaN(graceDate.getTime())) {
      return Date.now() >= graceDate.getTime();
    }
  }

  const cutoff = new Date(`${windowDate}T${String(RECON_CUTOFF_HOUR_UTC).padStart(2, '0')}:00:00.000Z`);
  return Date.now() >= cutoff.getTime();
};

const resolveDeliveryTiming = (payload) => {
  const rawExpectedArrival = payload?.expected_arrival_at
    || payload?.expectedArrivalAt
    || payload?.eta
    || null;

  const rawArrivalDate = payload?.arrival_date || payload?.arrivalDate || null;
  const rawArrivalTime = payload?.arrival_time || payload?.arrivalTime || null;

  let expectedArrivalAt = null;

  if (rawExpectedArrival) {
    expectedArrivalAt = toIsoTimestamp(rawExpectedArrival, 'expected_arrival_at');
  } else if (rawArrivalDate) {
    const datePart = toWindowDate(rawArrivalDate);
    const timePart = normalizeTimePart(rawArrivalTime);
    expectedArrivalAt = toIsoTimestamp(`${datePart}T${timePart}Z`, 'arrival_date/arrival_time');
  } else if (payload?.logged_date) {
    const datePart = toWindowDate(payload.logged_date);
    expectedArrivalAt = toIsoTimestamp(`${datePart}T12:00:00Z`, 'logged_date');
  } else {
    expectedArrivalAt = new Date().toISOString();
  }

  const rawGraceUntil = payload?.grace_until || payload?.graceUntil || null;
  const graceUntil = rawGraceUntil
    ? toIsoTimestamp(rawGraceUntil, 'grace_until')
    : addHours(expectedArrivalAt, DEFAULT_GRACE_HOURS);

  if (new Date(graceUntil).getTime() < new Date(expectedArrivalAt).getTime()) {
    throw new HttpError(400, 'grace_until must be after expected_arrival_at');
  }

  return { expectedArrivalAt, graceUntil };
};

const assertSessionProduct = (session, productId) => {
  if (!session || String(session.product_id || '') !== String(productId || '')) {
    throw new HttpError(400, 'delivery_session_id does not match product_id');
  }
};

const ensureOwnerDeliverySession = async ({ actor, organizationId, payload }) => {
  const requestedSessionId = String(payload?.delivery_session_id || payload?.deliverySessionId || '').trim();
  if (requestedSessionId) {
    const session = await findDeliverySessionById({
      organizationId,
      deliverySessionId: requestedSessionId,
    });
    assertSessionProduct(session, payload?.product_id);
    return session;
  }

  const { expectedArrivalAt, graceUntil } = resolveDeliveryTiming(payload);
  return createDeliverySession({
    organizationId,
    productId: payload.product_id,
    createdBy: actor.id,
    expectedArrivalAt,
    graceUntil,
    source: 'owner_entry',
    status: 'in_transit',
    notes: payload?.reference_note || null,
  });
};

const ensureStaffDeliverySession = async ({ actor, organizationId, payload }) => {
  const requestedSessionId = String(payload?.delivery_session_id || payload?.deliverySessionId || '').trim();
  if (requestedSessionId) {
    const session = await findDeliverySessionById({
      organizationId,
      deliverySessionId: requestedSessionId,
    });
    assertSessionProduct(session, payload?.product_id);
    return session;
  }

  const existingOpenSession = await findOpenDeliverySessionForProduct({
    organizationId,
    productId: payload.product_id,
  });

  if (existingOpenSession) {
    return existingOpenSession;
  }

  const { expectedArrivalAt, graceUntil } = resolveDeliveryTiming(payload);
  return createDeliverySession({
    organizationId,
    productId: payload.product_id,
    createdBy: actor.id,
    expectedArrivalAt,
    graceUntil,
    source: 'staff_entry',
    status: 'exception',
    notes: payload?.metadata?.notes || null,
  });
};

const applyReconciledSessionToProduct = async ({
  organizationId,
  deliverySession,
  ownerQuantity,
}) => {
  const currentlyApplied = Number(deliverySession?.inventory_applied_quantity || 0);
  const targetApplied = Number(ownerQuantity || 0);
  const deltaToApply = targetApplied - currentlyApplied;

  if (!Number.isFinite(deltaToApply) || Math.abs(deltaToApply) < 1e-9) {
    return {
      applied: false,
      deltaToApply: 0,
      totalApplied: currentlyApplied,
    };
  }

  const product = await findProductById(deliverySession.product_id, organizationId);
  const previousUnit = Number(product.unit || 0);
  const nextUnit = Math.max(0, previousUnit + deltaToApply);
  const latestOwnerEntry = await findLatestOwnerStockEntryForSession({
    organizationId,
    deliverySessionId: deliverySession.id,
    productId: deliverySession.product_id,
  });

  await updateProductUnit({
    productId: deliverySession.product_id,
    nextUnit,
    organizationId,
    unitPrice: latestOwnerEntry?.unit_price,
    boxPrice: latestOwnerEntry?.box_price,
  });

  await updateDeliverySessionInventoryApplied({
    organizationId,
    deliverySessionId: deliverySession.id,
    appliedQuantity: targetApplied,
  });

  return {
    applied: true,
    deltaToApply,
    totalApplied: targetApplied,
    previousUnit,
    nextUnit,
  };
};

const normalizeOwnerStockPayload = ({ payload, product }) => {
  const quantity = Number(payload?.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new HttpError(400, 'quantity must be a positive number');
  }

  const normalizedUnitType = String(payload?.unit_type || product?.base_unit || 'kg')
    .trim()
    .toLowerCase();

  if (!normalizedUnitType) {
    throw new HttpError(400, 'unit_type is required');
  }

  const normalized = {
    ...payload,
    quantity,
    unit_type: normalizedUnitType,
  };

  if (normalizedUnitType === 'box' || normalizedUnitType === 'carton') {
    const manualTotalWeight = Number(payload?.total_weight);
    if (Number.isFinite(manualTotalWeight) && manualTotalWeight > 0) {
      normalized.total_weight = manualTotalWeight;
      return normalized;
    }

    const standardBoxWeight = Number(product?.standard_box_weight || 0);
    const isVariableWeight = product?.is_variable_weight === true;
    if (!isVariableWeight && Number.isFinite(standardBoxWeight) && standardBoxWeight > 0) {
      normalized.total_weight = quantity * standardBoxWeight;
      return normalized;
    }

    throw new HttpError(
      400,
      'Box/carton stock entry requires total weight in KG or a configured standard box weight for this product',
    );
  }

  const totalWeight = Number(payload?.total_weight);
  if (normalizedUnitType === 'kg') {
    normalized.total_weight = Number.isFinite(totalWeight) && totalWeight > 0 ? totalWeight : quantity;
  } else if (Number.isFinite(totalWeight) && totalWeight > 0) {
    normalized.total_weight = totalWeight;
  }

  return normalized;
};

const runLegacyReconciliationForProductWindow = async ({ organizationId, productId, windowDate }) => {
  const ownerQuantity = await aggregateStockInQuantity({
    organizationId,
    productId,
    windowDate,
    unassignedOnly: true,
  });

  const staffQuantity = await aggregateStaffStockInQuantity({
    organizationId,
    productId,
    windowDate,
    unassignedOnly: true,
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

const runReconciliationForDeliverySession = async ({ organizationId, deliverySession }) => {
  const ownerQuantity = await aggregateStockInQuantityBySession({
    organizationId,
    productId: deliverySession.product_id,
    deliverySessionId: deliverySession.id,
  });

  const staffQuantity = await aggregateStaffStockInQuantityBySession({
    organizationId,
    productId: deliverySession.product_id,
    deliverySessionId: deliverySession.id,
  });

  const windowDate = toWindowDate(deliverySession.expected_arrival_at);
  const difference = ownerQuantity - staffQuantity;
  const status = deriveReconciliationStatus({ ownerQuantity, staffQuantity });
  const isEscalated = shouldEscalate({
    status,
    windowDate,
    graceUntil: deliverySession.grace_until,
  });

  const record = await saveReconciliationWindow({
    organizationId,
    productId: deliverySession.product_id,
    deliverySessionId: deliverySession.id,
    windowDate,
    ownerQuantity,
    staffQuantity,
    difference,
    status,
    isEscalated,
  });

  const sessionStatus = deriveDeliverySessionStatus({ ownerQuantity, staffQuantity });
  await updateDeliverySessionState({
    organizationId,
    deliverySessionId: deliverySession.id,
    status: sessionStatus,
    isEscalated,
  });

  if (record.status === 'match') {
    await applyReconciledSessionToProduct({
      organizationId,
      deliverySession,
      ownerQuantity,
    });
  }

  return record;
};

const runReconciliationForWindow = async ({ actor, organizationId, windowDate }) => {
  assertRole(actor, ['admin', 'manager']);
  const orgId = resolveOrganizationId(actor, organizationId);
  const targetWindowDate = toWindowDate(windowDate);

  const results = [];
  let sessions = [];

  try {
    sessions = await listActiveDeliverySessionsUpToWindow({
      organizationId: orgId,
      windowDate: targetWindowDate,
    });
  } catch (error) {
    if (!isDeliverySessionMigrationError(error)) {
      throw error;
    }
  }

  for (const session of sessions) {
    const record = await runReconciliationForDeliverySession({
      organizationId: orgId,
      deliverySession: session,
    });
    results.push(record);
  }

  const legacyProductIds = await listWindowProductIds({
    organizationId: orgId,
    windowDate: targetWindowDate,
    unassignedOnly: true,
  });

  for (const productId of legacyProductIds) {
    const record = await runLegacyReconciliationForProductWindow({
      organizationId: orgId,
      productId,
      windowDate: targetWindowDate,
    });
    results.push(record);
  }

  const uniqueProducts = new Set(results.map((record) => String(record.product_id || '')));

  return {
    windowDate: targetWindowDate,
    totalProductsChecked: uniqueProducts.size,
    mismatchCount: results.filter((record) => record.status === 'mismatch').length,
    missingCount: results.filter((record) => record.status === 'missing_in_sales').length,
    extraCount: results.filter((record) => record.status === 'extra_in_sales').length,
    escalatedCount: results.filter((record) => record.is_escalated === true).length,
  };
};

const addStockEntry = async ({ actor, payload }) => {
  assertRole(actor, ['admin', 'manager']);
  if (!payload?.product_id) {
    throw new HttpError(400, 'product_id is required');
  }

  const organizationId = resolveOrganizationId(actor, payload.organization_id);
  const product = await findProductById(payload.product_id, organizationId);
  const normalizedPayload = normalizeOwnerStockPayload({
    payload,
    product,
  });

  const deliverySession = await ensureOwnerDeliverySession({
    actor,
    organizationId,
    payload: normalizedPayload,
  });

  const record = await insertStockIn({
    ...stripSessionOnlyFields(normalizedPayload),
    organization_id: organizationId,
    recorded_by: actor.id,
    delivery_session_id: deliverySession.id,
  });

  try {
    await runReconciliationForDeliverySession({
      organizationId,
      deliverySession,
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
  const deliverySession = await ensureStaffDeliverySession({
    actor,
    organizationId,
    payload,
  });

  const record = await insertStaffStockIn({
    ...stripSessionOnlyFields(payload),
    organization_id: organizationId,
    recorded_by: actor.id,
    delivery_session_id: deliverySession.id,
  });

  try {
    await runReconciliationForDeliverySession({
      organizationId,
      deliverySession,
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
  const latestOwnerEntry = reconciliation.delivery_session_id
    ? await findLatestOwnerStockEntryForSession({
      organizationId,
      deliverySessionId: reconciliation.delivery_session_id,
      productId: targetProductId,
    })
    : null;
  const previousUnit = Number(product.unit || 0);
  const nextUnit = previousUnit + quantity;

  await updateProductUnit({
    productId: targetProductId,
    nextUnit,
    organizationId,
    unitPrice: latestOwnerEntry?.unit_price,
    boxPrice: latestOwnerEntry?.box_price,
  });
  await updateReconciliationStatus({ reconciliationId, status: 'resolved', organizationId });

  if (reconciliation.delivery_session_id) {
    const session = await findDeliverySessionById({
      organizationId,
      deliverySessionId: reconciliation.delivery_session_id,
    });
    await updateDeliverySessionState({
      organizationId,
      deliverySessionId: reconciliation.delivery_session_id,
      status: 'received',
      isEscalated: false,
    });
    await updateDeliverySessionInventoryApplied({
      organizationId,
      deliverySessionId: reconciliation.delivery_session_id,
      appliedQuantity: Math.max(0, Number(session.inventory_applied_quantity || 0) + quantity),
    });
  }

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
