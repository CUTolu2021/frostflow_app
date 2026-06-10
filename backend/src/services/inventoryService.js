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
const {
  getOrganizationById,
  normalizeInventoryMode,
} = require('../repositories/organizationsRepository');
const { createSale, markSaleVoided } = require('../repositories/salesRepository');
const { insertAuditLog } = require('../repositories/auditRepository');
const { env } = require('../config/env');
const {
  Decimal,
  toPositiveQuantityDecimal,
  toNonNegativeQuantityDecimal,
  toNonNegativeMoneyDecimal,
  toNumber,
} = require('../utils/decimal');

const RECON_CUTOFF_HOUR_UTC = Number.isFinite(Number(env.reconciliationCutoffHourUtc))
  ? Number(env.reconciliationCutoffHourUtc)
  : 20;
const DEFAULT_GRACE_HOURS = Number.isFinite(Number(env.reconciliationDefaultGraceHours))
  ? Math.max(1, Number(env.reconciliationDefaultGraceHours))
  : 24;
const AUTO_ACCEPT_TOLERANCE_KG = Number.isFinite(Number(env.reconciliationAutoAcceptToleranceKg))
  ? Math.max(0, Number(env.reconciliationAutoAcceptToleranceKg))
  : 0.5;

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

const isWithinAutoAcceptTolerance = ({ ownerQuantity, staffQuantity }) => {
  const owner = Number(ownerQuantity || 0);
  const staff = Number(staffQuantity || 0);
  if (owner <= 0 || staff <= 0) return false;
  return Math.abs(owner - staff) <= AUTO_ACCEPT_TOLERANCE_KG;
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

const resolveOrganizationInventoryMode = async (organizationId) => {
  const organization = await getOrganizationById({ organizationId });
  return normalizeInventoryMode(organization?.inventory_mode);
};

const normalizeBaseUnit = (value) => String(value || 'kg').trim().toLowerCase();
const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'credit'];

const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';

const toOptionalMoneyValue = (value, fieldName) => {
  if (!hasValue(value)) return undefined;
  return toNumber(toNonNegativeMoneyDecimal(value, fieldName));
};

const toOptionalQuantityValue = (value, fieldName) => {
  if (!hasValue(value)) return undefined;
  return toNumber(toPositiveQuantityDecimal(value, fieldName));
};

const normalizePaymentMethod = (value, fieldName = 'payment_method') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    throw new HttpError(400, `${fieldName} is required`);
  }
  if (!PAYMENT_METHODS.includes(normalized) && normalized !== 'mixed') {
    throw new HttpError(400, `${fieldName} must be one of: ${PAYMENT_METHODS.join(', ')}, mixed`);
  }
  return normalized;
};

const normalizeSalePayments = ({ payload, totalPriceDecimal, paymentMethod }) => {
  const rawPayments = Array.isArray(payload?.payments) ? payload.payments : [];

  if (paymentMethod !== 'mixed' && rawPayments.length === 0) {
    return [
      {
        method: paymentMethod,
        amount: toNumber(totalPriceDecimal),
        reference_note: null,
      },
    ];
  }

  if (rawPayments.length === 0) {
    throw new HttpError(400, 'Add at least one payment line for a mixed payment sale');
  }

  const normalizedPayments = rawPayments.map((entry, index) => {
    const method = normalizePaymentMethod(entry?.method, `payments[${index}].method`);
    if (method === 'mixed') {
      throw new HttpError(400, 'Payment line method cannot be mixed');
    }

    const amount = toNonNegativeMoneyDecimal(entry?.amount, `payments[${index}].amount`);
    if (amount.lte(0)) {
      throw new HttpError(400, `payments[${index}].amount must be greater than zero`);
    }

    return {
      method,
      amount: toNumber(amount),
      reference_note: hasValue(entry?.reference_note) ? String(entry.reference_note).trim() : null,
      amountDecimal: amount,
    };
  });

  const sum = normalizedPayments.reduce(
    (acc, item) => acc.plus(item.amountDecimal),
    new Decimal(0),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  if (!sum.equals(totalPriceDecimal)) {
    throw new HttpError(400, 'Payment breakdown must add up exactly to the sale total');
  }

  if (paymentMethod !== 'mixed' && normalizedPayments.length === 1 && normalizedPayments[0].method !== paymentMethod) {
    throw new HttpError(400, 'Single payment line must match the selected payment method');
  }

  if (paymentMethod === 'mixed' && normalizedPayments.length < 2) {
    throw new HttpError(400, 'Mixed payments require at least two payment lines');
  }

  return normalizedPayments.map(({ amountDecimal: _ignored, ...item }) => item);
};

const supportsBoxUnit = (product) => {
  if (!product) return false;
  return (
    normalizeBaseUnit(product.base_unit) === 'box'
    || product.is_variable_weight === true
    || Number(product.standard_box_weight || 0) > 0
    || Number(product.box_price || 0) > 0
  );
};

const validateUnitTypeForProduct = ({ product, unitType }) => {
  const normalizedUnitType = normalizeBaseUnit(unitType);
  const productBaseUnit = normalizeBaseUnit(product?.base_unit || 'kg');
  const canUseBox = supportsBoxUnit(product);

  if (normalizedUnitType === productBaseUnit) {
    return normalizedUnitType;
  }

  if ((normalizedUnitType === 'box' || normalizedUnitType === 'carton') && canUseBox) {
    return normalizedUnitType;
  }

  throw new HttpError(
    400,
    `Unit type "${normalizedUnitType}" is not valid for this product. Use ${productBaseUnit}${canUseBox ? ' or box/carton' : ''}.`,
  );
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

const applySessionQuantityToProduct = async ({
  organizationId,
  deliverySession,
  targetQuantity,
}) => {
  const currentlyApplied = new Decimal(String(deliverySession?.inventory_applied_quantity || 0));
  const targetApplied = toPositiveQuantityDecimal(targetQuantity, 'targetQuantity');
  const deltaToApply = targetApplied.minus(currentlyApplied).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  if (deltaToApply.isZero()) {
    return {
      applied: false,
      deltaToApply: 0,
      totalApplied: toNumber(currentlyApplied),
    };
  }

  const product = await findProductById(deliverySession.product_id, organizationId);
  const previousUnit = new Decimal(String(product.unit || 0));
  const nextUnit = previousUnit.plus(deltaToApply).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  if (nextUnit.isNegative()) {
    throw new HttpError(
      400,
      'Cannot apply reconciliation quantity because resulting stock would be negative.',
    );
  }
  const latestOwnerEntry = await findLatestOwnerStockEntryForSession({
    organizationId,
    deliverySessionId: deliverySession.id,
    productId: deliverySession.product_id,
  });

  const hasUnitPriceUpdate = Number.isFinite(Number(latestOwnerEntry?.unit_price))
    && Number(latestOwnerEntry.unit_price) >= 0;
  const hasBoxPriceUpdate = Number.isFinite(Number(latestOwnerEntry?.box_price))
    && Number(latestOwnerEntry.box_price) >= 0;
  const nextUnitPrice = hasUnitPriceUpdate ? Number(latestOwnerEntry.unit_price) : Number(product.unit_price || 0);
  const nextBoxPrice = hasBoxPriceUpdate ? Number(latestOwnerEntry.box_price) : Number(product.box_price || 0);
  const prevUnitPrice = Number(product.unit_price || 0);
  const prevBoxPrice = Number(product.box_price || 0);
  const unitPriceChanged = hasUnitPriceUpdate && nextUnitPrice !== prevUnitPrice;
  const boxPriceChanged = hasBoxPriceUpdate && nextBoxPrice !== prevBoxPrice;

  await updateProductUnit({
    productId: deliverySession.product_id,
    nextUnit: toNumber(nextUnit),
    organizationId,
    unitPrice: latestOwnerEntry?.unit_price,
    boxPrice: latestOwnerEntry?.box_price,
  });

  await updateDeliverySessionInventoryApplied({
    organizationId,
    deliverySessionId: deliverySession.id,
    appliedQuantity: toNumber(targetApplied),
  });

  if (unitPriceChanged || boxPriceChanged) {
    const changedFields = [
      unitPriceChanged ? 'unit_price' : null,
      boxPriceChanged ? 'box_price' : null,
    ].filter(Boolean).join(', ');
    const changedBy = latestOwnerEntry?.recorded_by || deliverySession?.created_by || null;

    await insertAuditLog({
      tableName: 'products',
      recordId: deliverySession.product_id,
      action: `Price updated from stock reconciliation (${changedFields})`,
      changedBy,
      organizationId,
      beforeData: {
        product_id: deliverySession.product_id,
        delivery_session_id: deliverySession.id,
        source_stock_in_id: latestOwnerEntry?.id || null,
        unit_price: prevUnitPrice,
        box_price: prevBoxPrice,
      },
      afterData: {
        product_id: deliverySession.product_id,
        delivery_session_id: deliverySession.id,
        source_stock_in_id: latestOwnerEntry?.id || null,
        unit_price: nextUnitPrice,
        box_price: nextBoxPrice,
      },
    });
  }

  return {
    applied: true,
    deltaToApply: toNumber(deltaToApply),
    totalApplied: toNumber(targetApplied),
    previousUnit: toNumber(previousUnit),
    nextUnit: toNumber(nextUnit),
  };
};

const normalizeOwnerStockPayload = ({ payload, product }) => {
  const quantityDecimal = toPositiveQuantityDecimal(payload?.quantity, 'quantity');
  const quantity = toNumber(quantityDecimal);

  const normalizedUnitType = validateUnitTypeForProduct({
    product,
    unitType: payload?.unit_type || product?.base_unit || 'kg',
  });

  const normalized = {
    ...payload,
    quantity,
    unit_type: normalizedUnitType,
  };

  if (normalizedUnitType === 'box' || normalizedUnitType === 'carton') {
    const productBaseUnit = String(product?.base_unit || 'kg').trim().toLowerCase();
    if (productBaseUnit === 'box') {
      normalized.total_weight = quantity;
    } else {
      const manualTotalWeight = toOptionalQuantityValue(payload?.total_weight, 'total_weight');
      if (manualTotalWeight !== undefined) {
        normalized.total_weight = manualTotalWeight;
      } else {
        const standardBoxWeight = Number(product?.standard_box_weight || 0);
        const isVariableWeight = product?.is_variable_weight === true;
        if (!isVariableWeight && Number.isFinite(standardBoxWeight) && standardBoxWeight > 0) {
          normalized.total_weight = toNumber(
            quantityDecimal.mul(standardBoxWeight).toDecimalPlaces(3, Decimal.ROUND_HALF_UP),
          );
        } else {
          throw new HttpError(
            400,
            'Box/carton stock entry requires invoice total in base unit or a configured standard units-per-box value',
          );
        }
      }
    }
  }

  const totalWeight = toOptionalQuantityValue(payload?.total_weight, 'total_weight');
  if (normalizedUnitType === 'kg') {
    normalized.total_weight = totalWeight !== undefined ? totalWeight : quantity;
  } else if (totalWeight !== undefined) {
    normalized.total_weight = totalWeight;
  }

  normalized.unit_cost = toOptionalMoneyValue(payload?.unit_cost, 'unit_cost');
  normalized.unit_price = toOptionalMoneyValue(payload?.unit_price, 'unit_price');
  normalized.box_price = toOptionalMoneyValue(payload?.box_price, 'box_price');
  normalized.logistics_fee = toOptionalMoneyValue(payload?.logistics_fee, 'logistics_fee');

  if (normalized.unit_cost !== undefined) {
    normalized.total_cost = toNumber(
      quantityDecimal
        .mul(normalized.unit_cost)
        .plus(normalized.logistics_fee || 0)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    );
  } else if (hasValue(payload?.total_cost)) {
    normalized.total_cost = toNumber(toNonNegativeMoneyDecimal(payload.total_cost, 'total_cost'));
  }

  return normalized;
};

const normalizeSalePayload = ({ payload, product }) => {
  const quantityDecimal = toPositiveQuantityDecimal(payload?.quantity, 'quantity');
  const quantity = toNumber(quantityDecimal);

  const unitPriceDecimal = toNonNegativeMoneyDecimal(
    payload?.unit_price ?? payload?.selling_price,
    'unit_price',
  );
  const unitPrice = toNumber(unitPriceDecimal);

  const paymentMethod = normalizePaymentMethod(payload?.payment_method);

  const normalizedUnitType = validateUnitTypeForProduct({
    product,
    unitType: payload?.unit_type || product?.base_unit || 'kg',
  });

  let stockReductionKgDecimal = quantityDecimal;
  let boxWeight = null;

  if (normalizedUnitType === 'box' || normalizedUnitType === 'carton') {
    const productBaseUnit = String(product?.base_unit || 'kg').trim().toLowerCase();
    if (productBaseUnit === 'box') {
      stockReductionKgDecimal = quantityDecimal;
    } else {
      const rawBoxWeight = payload?.box_weight ?? payload?.box_weight_kg;
      if (hasValue(rawBoxWeight)) {
        const explicitBoxWeightDecimal = toPositiveQuantityDecimal(rawBoxWeight, 'box_weight');
        boxWeight = toNumber(explicitBoxWeightDecimal);
        stockReductionKgDecimal = quantityDecimal
          .mul(explicitBoxWeightDecimal)
          .toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
      } else {
        const standardBoxWeight = Number(product?.standard_box_weight || 0);
        if (!Number.isFinite(standardBoxWeight) || standardBoxWeight <= 0) {
          throw new HttpError(
            400,
            'Box/carton sale requires product standard units-per-box or explicit box_weight in request',
          );
        }
        const standardBoxWeightDecimal = toPositiveQuantityDecimal(standardBoxWeight, 'standard_box_weight');
        boxWeight = toNumber(standardBoxWeightDecimal);
        stockReductionKgDecimal = quantityDecimal
          .mul(standardBoxWeightDecimal)
          .toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
      }
    }
  }

  if (stockReductionKgDecimal.lte(0)) {
    throw new HttpError(400, 'Unable to calculate stock reduction');
  }

  const totalPriceDecimal = hasValue(payload?.total_price)
    ? toNonNegativeMoneyDecimal(payload.total_price, 'total_price')
    : quantityDecimal
      .mul(unitPriceDecimal)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalPrice = toNumber(totalPriceDecimal);
  const payments = normalizeSalePayments({
    payload,
    totalPriceDecimal,
    paymentMethod,
  });

  return {
    quantity,
    unitPrice,
    totalPrice,
    paymentMethod,
    payments,
    unitType: normalizedUnitType,
    stockReductionKg: toNumber(stockReductionKgDecimal),
    boxWeight,
    customerType: payload?.customer_type || null,
    invoiceId: hasValue(payload?.invoice_id) ? String(payload.invoice_id).trim() : null,
  };
};

const normalizeStaffStockPayload = ({ payload, product }) => {
  const quantity = toNumber(toPositiveQuantityDecimal(payload?.quantity, 'quantity'));

  const normalizedUnitType = validateUnitTypeForProduct({
    product,
    unitType: payload?.unit_type || product?.base_unit || 'kg',
  });

  const metadata = payload?.metadata && typeof payload.metadata === 'object'
    ? { ...payload.metadata }
    : {};

  if (normalizedUnitType === 'box' || normalizedUnitType === 'carton') {
    const productBaseUnit = normalizeBaseUnit(product?.base_unit || 'kg');
    if (productBaseUnit !== 'box') {
      const measuredTotal = (
        metadata.total_weight
        ?? metadata.totalWeight
        ?? payload?.total_weight
      );

      if (!hasValue(measuredTotal)) {
        throw new HttpError(
          400,
          `Box receipt requires measured total ${productBaseUnit} from sales receiving`,
        );
      }

      metadata.total_weight = toNumber(toPositiveQuantityDecimal(measuredTotal, 'total_weight'));
    }
  }

  if (Array.isArray(metadata.measured_box_weights)) {
    metadata.measured_box_weights = metadata.measured_box_weights
      .map((value) => {
        try {
          return toNumber(toPositiveQuantityDecimal(value, 'measured_box_weights'));
        } catch (error) {
          return null;
        }
      })
      .filter((value) => value !== null);
  }

  return {
    ...payload,
    quantity,
    unit_type: normalizedUnitType,
    metadata,
  };
};

const calculateStockImpactFromEntry = ({
  quantity,
  unitType,
  product,
  totalWeight,
  metadata,
}) => {
  const qtyDecimal = toPositiveQuantityDecimal(quantity, 'quantity');

  const normalizedUnitType = normalizeBaseUnit(unitType);
  if (normalizedUnitType === 'box' || normalizedUnitType === 'carton') {
    if (normalizeBaseUnit(product?.base_unit) === 'box') {
      return toNumber(qtyDecimal);
    }

    if (hasValue(totalWeight)) {
      return toNumber(toPositiveQuantityDecimal(totalWeight, 'total_weight'));
    }

    const metadataWeight = metadata?.total_weight ?? metadata?.totalWeight;
    if (hasValue(metadataWeight)) {
      return toNumber(toPositiveQuantityDecimal(metadataWeight, 'metadata.total_weight'));
    }

    const standardBoxWeight = Number(product?.standard_box_weight || 0);
    if (Number.isFinite(standardBoxWeight) && standardBoxWeight > 0) {
      return toNumber(
        qtyDecimal.mul(standardBoxWeight).toDecimalPlaces(3, Decimal.ROUND_HALF_UP),
      );
    }

    throw new HttpError(400, 'Unable to derive stock impact for box/carton entry');
  }

  return toNumber(qtyDecimal);
};

const applySingleOperatorStockEntry = async ({
  organizationId,
  actor,
  product,
  stockImpactQuantity,
  source,
  sourceRecordId,
  unitType,
  quantity,
  totalWeight,
  unitPrice,
  boxPrice,
  deliverySessionId,
}) => {
  const previousUnit = new Decimal(String(product.unit || 0));
  const nextUnit = previousUnit.plus(stockImpactQuantity).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  if (nextUnit.isNegative()) {
    throw new HttpError(400, 'Unable to apply stock entry in single-operator mode');
  }

  await updateProductUnit({
    productId: product.id,
    nextUnit: toNumber(nextUnit),
    organizationId,
    unitPrice,
    boxPrice,
  });

  if (deliverySessionId) {
    await updateDeliverySessionState({
      organizationId,
      deliverySessionId,
      status: 'received',
      isEscalated: false,
    });
    await updateDeliverySessionInventoryApplied({
      organizationId,
      deliverySessionId,
      appliedQuantity: toNumber(
        new Decimal(String(stockImpactQuantity || 0)).max(0).toDecimalPlaces(3, Decimal.ROUND_HALF_UP),
      ),
    });
  }

  await insertAuditLog({
    tableName: 'products',
    recordId: product.id,
    action: `DIRECT_STOCK_APPLY_SINGLE_OPERATOR (${source})`,
    changedBy: actor.id,
    organizationId,
    beforeData: {
      product_id: product.id,
      previous_unit: toNumber(previousUnit),
    },
    afterData: {
      product_id: product.id,
      next_unit: toNumber(nextUnit),
      source_record_id: sourceRecordId,
      delivery_session_id: deliverySessionId || null,
      source,
      quantity,
      unit_type: unitType,
      total_weight: totalWeight ?? null,
      stock_impact_quantity: stockImpactQuantity,
    },
  });
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
  const withinTolerance = isWithinAutoAcceptTolerance({ ownerQuantity, staffQuantity });
  const effectiveStatus = withinTolerance ? 'match' : status;
  const isEscalated = shouldEscalate({
    status: effectiveStatus,
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
    status: effectiveStatus,
    isEscalated,
  });

  const sessionStatus = withinTolerance
    ? 'received'
    : deriveDeliverySessionStatus({ ownerQuantity, staffQuantity });
  await updateDeliverySessionState({
    organizationId,
    deliverySessionId: deliverySession.id,
    status: sessionStatus,
    isEscalated,
  });

  // Inventory source of truth:
  // Auto-apply only when the owner/staff variance is within tolerance.
  if (withinTolerance) {
    await applySessionQuantityToProduct({
      organizationId,
      deliverySession,
      targetQuantity: staffQuantity,
    });

    if (Math.abs(difference) > 1e-9) {
      await insertAuditLog({
        tableName: 'reconciliation',
        recordId: record.id,
        action: `AUTO_ACCEPTED_WITHIN_TOLERANCE (${AUTO_ACCEPT_TOLERANCE_KG}kg)`,
        changedBy: deliverySession.created_by || null,
        organizationId,
        beforeData: {
          owner_quantity: ownerQuantity,
          staff_quantity: staffQuantity,
          difference,
          status,
        },
        afterData: {
          status: effectiveStatus,
          tolerance_kg: AUTO_ACCEPT_TOLERANCE_KG,
          inventory_applied_quantity: staffQuantity,
        },
      });
    }
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
  const inventoryMode = await resolveOrganizationInventoryMode(organizationId);
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

  if (inventoryMode === 'single_operator') {
    const stockImpactQuantity = calculateStockImpactFromEntry({
      quantity: normalizedPayload.quantity,
      unitType: normalizedPayload.unit_type,
      product,
      totalWeight: normalizedPayload.total_weight,
    });

    await applySingleOperatorStockEntry({
      organizationId,
      actor,
      product,
      stockImpactQuantity,
      source: 'owner_stock_in',
      sourceRecordId: record.id,
      unitType: normalizedPayload.unit_type,
      quantity: normalizedPayload.quantity,
      totalWeight: normalizedPayload.total_weight,
      unitPrice: normalizedPayload.unit_price,
      boxPrice: normalizedPayload.box_price,
      deliverySessionId: deliverySession.id,
    });

    return record;
  }

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

  const organizationId = resolveOrganizationId(actor, payload.organization_id);
  const inventoryMode = await resolveOrganizationInventoryMode(organizationId);
  const product = await findProductById(payload.product_id, organizationId);
  const normalizedPayload = normalizeStaffStockPayload({
    payload,
    product,
  });
  const deliverySession = await ensureStaffDeliverySession({
    actor,
    organizationId,
    payload: normalizedPayload,
  });

  const record = await insertStaffStockIn({
    ...stripSessionOnlyFields(normalizedPayload),
    organization_id: organizationId,
    recorded_by: actor.id,
    delivery_session_id: deliverySession.id,
  });

  if (inventoryMode === 'single_operator') {
    const stockImpactQuantity = calculateStockImpactFromEntry({
      quantity: normalizedPayload.quantity,
      unitType: normalizedPayload.unit_type,
      product,
      totalWeight: normalizedPayload.total_weight,
      metadata: normalizedPayload.metadata,
    });

    await applySingleOperatorStockEntry({
      organizationId,
      actor,
      product,
      stockImpactQuantity,
      source: 'staff_stock_in',
      sourceRecordId: record.id,
      unitType: normalizedPayload.unit_type,
      quantity: normalizedPayload.quantity,
      totalWeight: normalizedPayload.total_weight ?? normalizedPayload.metadata?.total_weight,
      deliverySessionId: deliverySession.id,
    });

    return record;
  }

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

const recordDailySale = async ({ actor, payload }) => {
  assertRole(actor, ['admin', 'manager', 'sales']);
  if (!payload?.product_id) {
    throw new HttpError(400, 'product_id is required');
  }

  const organizationId = resolveOrganizationId(actor, payload.organization_id);
  const product = await findProductById(payload.product_id, organizationId);
  const normalized = normalizeSalePayload({
    payload,
    product,
  });

  const previousUnit = new Decimal(String(product.unit || 0));
  const stockReductionKg = toPositiveQuantityDecimal(normalized.stockReductionKg, 'stockReductionKg');
  if (previousUnit.lt(stockReductionKg)) {
    throw new HttpError(400, 'Insufficient stock for this sale');
  }

  const nextUnit = previousUnit.minus(stockReductionKg).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  await updateProductUnit({
    productId: product.id,
    organizationId,
    nextUnit: toNumber(nextUnit),
  });

  const sale = await createSale({
    organizationId,
    productId: product.id,
    quantity: normalized.quantity,
    sellingPrice: normalized.unitPrice,
    totalPrice: normalized.totalPrice,
    paymentMethod: normalized.paymentMethod,
    payments: normalized.payments,
    recordedBy: actor.id,
    customerType: normalized.customerType,
    unitType: normalized.unitType,
    boxWeight: normalized.boxWeight,
    status: 'completed',
    invoiceId: normalized.invoiceId,
  });

  await insertAuditLog({
    tableName: 'sales',
    recordId: sale.id,
    action: 'RECORDED_SALE',
    changedBy: actor.id,
    organizationId,
    beforeData: {
      product_id: product.id,
      product_name: product.name,
      product_unit_before: toNumber(previousUnit),
    },
    afterData: {
      sale_id: sale.id,
      quantity: normalized.quantity,
      unit_type: normalized.unitType,
      stock_reduction_kg: normalized.stockReductionKg,
      product_unit_after: toNumber(nextUnit),
      total_price: normalized.totalPrice,
      payment_method: normalized.paymentMethod,
      payments: normalized.payments,
    },
  });

  return sale;
};

const voidSale = async ({ actor, saleId, productId, quantityToReturn, reason }) => {
  assertRole(actor, ['admin', 'manager']);

  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason || normalizedReason.length < 5) {
    throw new HttpError(400, 'Void reason must be at least 5 characters');
  }

  const returnQuantity = toNumber(toPositiveQuantityDecimal(quantityToReturn, 'quantityToReturn'));

  const organizationId = resolveOrganizationId(actor);
  const product = await findProductById(productId, organizationId);
  const previousUnit = new Decimal(String(product.unit || 0));
  const nextUnit = previousUnit.plus(returnQuantity).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);

  await markSaleVoided({ saleId, organizationId });
  await updateProductUnit({ productId, nextUnit: toNumber(nextUnit), organizationId });

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
      previousUnit: toNumber(previousUnit),
    },
    afterData: {
      status: 'voided',
      reason: normalizedReason,
      unit: toNumber(nextUnit),
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

  const quantity = toNumber(toNonNegativeQuantityDecimal(finalQuantity, 'finalQuantity'));

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
  const previousUnit = new Decimal(String(product.unit || 0));
  let nextUnit = previousUnit.plus(quantity).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  let targetAppliedForSession = null;
  const previousUnitPrice = Number(product.unit_price || 0);
  const previousBoxPrice = Number(product.box_price || 0);
  const nextUnitPrice = Number.isFinite(Number(latestOwnerEntry?.unit_price))
    ? Number(latestOwnerEntry.unit_price)
    : previousUnitPrice;
  const nextBoxPrice = Number.isFinite(Number(latestOwnerEntry?.box_price))
    ? Number(latestOwnerEntry.box_price)
    : previousBoxPrice;

  if (reconciliation.delivery_session_id) {
    const session = await findDeliverySessionById({
      organizationId,
      deliverySessionId: reconciliation.delivery_session_id,
    });

    const currentApplied = new Decimal(String(session.inventory_applied_quantity || 0));
    targetAppliedForSession = toNumber(
      new Decimal(quantity).max(0).toDecimalPlaces(3, Decimal.ROUND_HALF_UP),
    );
    const deltaToApply = new Decimal(targetAppliedForSession)
      .minus(currentApplied)
      .toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    nextUnit = previousUnit.plus(deltaToApply).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    if (nextUnit.isNegative()) {
      throw new HttpError(
        400,
        'Cannot resolve mismatch with this quantity because resulting stock would be negative.',
      );
    }

    await updateProductUnit({
      productId: targetProductId,
      nextUnit: toNumber(nextUnit),
      organizationId,
      unitPrice: latestOwnerEntry?.unit_price,
      boxPrice: latestOwnerEntry?.box_price,
    });
    await updateReconciliationStatus({ reconciliationId, status: 'resolved', organizationId });

    await updateDeliverySessionState({
      organizationId,
      deliverySessionId: reconciliation.delivery_session_id,
      status: 'received',
      isEscalated: false,
    });
    await updateDeliverySessionInventoryApplied({
      organizationId,
      deliverySessionId: reconciliation.delivery_session_id,
      appliedQuantity: targetAppliedForSession,
    });
  } else {
    await updateProductUnit({
      productId: targetProductId,
      nextUnit: toNumber(nextUnit),
      organizationId,
      unitPrice: latestOwnerEntry?.unit_price,
      boxPrice: latestOwnerEntry?.box_price,
    });
    await updateReconciliationStatus({ reconciliationId, status: 'resolved', organizationId });
  }

  await insertAuditLog({
    tableName: 'reconciliation',
    recordId: reconciliationId,
    action: `RESOLVED_MISMATCH: ${normalizedNote}`,
    changedBy: actor.id,
    organizationId,
    beforeData: {
      product: product.name,
      quantity: toNumber(previousUnit),
      status: reconciliation.status,
    },
    afterData: {
      product: product.name,
      quantity: toNumber(nextUnit),
      status: 'resolved',
    },
  });

  const unitPriceChanged = nextUnitPrice !== previousUnitPrice;
  const boxPriceChanged = nextBoxPrice !== previousBoxPrice;
  if (unitPriceChanged || boxPriceChanged) {
    const changedFields = [
      unitPriceChanged ? 'unit_price' : null,
      boxPriceChanged ? 'box_price' : null,
    ].filter(Boolean).join(', ');

    await insertAuditLog({
      tableName: 'products',
      recordId: targetProductId,
      action: `Applied price from mismatch resolution (${changedFields})`,
      changedBy: actor.id,
      organizationId,
      beforeData: {
        product_id: targetProductId,
        reconciliation_id: reconciliationId,
        source_stock_in_id: latestOwnerEntry?.id || null,
        unit_price: previousUnitPrice,
        box_price: previousBoxPrice,
      },
      afterData: {
        product_id: targetProductId,
        reconciliation_id: reconciliationId,
        source_stock_in_id: latestOwnerEntry?.id || null,
        unit_price: nextUnitPrice,
        box_price: nextBoxPrice,
      },
    });
  }
};

module.exports = {
  addStaffStockEntry,
  addStockEntry,
  recordDailySale,
  runReconciliationForWindow,
  resolveMismatch,
  voidSale,
};
