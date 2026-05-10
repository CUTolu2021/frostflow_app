const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const table = (name) => supabase.schema(env.supabaseSchema).from(name);

const isMissingReconciliationWindowColumnsError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('window_date') ||
    message.includes('is_escalated') ||
    message.includes('escalated_at')
  );
};

const isMissingDeliverySessionSchemaError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('delivery_sessions') ||
    message.includes('delivery_session_id') ||
    message.includes('inventory_applied_quantity') ||
    message.includes('inventory_applied_at') ||
    message.includes("relation \"frostflow_data.delivery_sessions\" does not exist") ||
    message.includes("could not find the table 'delivery_sessions'")
  );
};

const throwDeliverySessionSchemaError = () => {
  throw new HttpError(400, 'delivery session columns are missing. Run backend/sql/011_delivery_sessions.sql');
};

const insertStockIn = async (payload) => {
  const { data, error } = await table('stock_in').insert(payload).select('*').single();
  if (error || !data) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to add stock entry');
  }
  return data;
};

const insertStaffStockIn = async (payload) => {
  const { data, error } = await table('stock_in_staff').insert(payload).select('*').single();
  if (error || !data) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to add staff stock entry');
  }
  return data;
};

const createDeliverySession = async ({
  organizationId,
  productId,
  createdBy,
  expectedArrivalAt,
  graceUntil,
  source,
  status,
  notes,
}) => {
  const { data, error } = await table('delivery_sessions')
    .insert({
      organization_id: organizationId,
      product_id: productId,
      created_by: createdBy || null,
      expected_arrival_at: expectedArrivalAt,
      grace_until: graceUntil,
      source: source || 'owner_entry',
      status: status || 'in_transit',
      notes: notes || null,
    })
    .select('*')
    .single();

  if (error || !data) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to create delivery session');
  }

  return data;
};

const findDeliverySessionById = async ({ organizationId, deliverySessionId }) => {
  const { data, error } = await table('delivery_sessions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', deliverySessionId)
    .single();

  if (error || !data) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(404, 'Delivery session not found');
  }

  return data;
};

const findOpenDeliverySessionForProduct = async ({ organizationId, productId }) => {
  const { data, error } = await table('delivery_sessions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .in('status', ['in_transit', 'partially_received', 'exception'])
    .order('expected_arrival_at', { ascending: true })
    .limit(1);

  if (error) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to find open delivery session');
  }

  return (data || [])[0] || null;
};

const listActiveDeliverySessionsUpToWindow = async ({ organizationId, windowDate }) => {
  const endExclusive = new Date(`${windowDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const { data, error } = await table('delivery_sessions')
    .select('id,product_id,expected_arrival_at,grace_until,status,inventory_applied_quantity,inventory_applied_at')
    .eq('organization_id', organizationId)
    .in('status', ['in_transit', 'partially_received', 'exception'])
    .lt('expected_arrival_at', endExclusive.toISOString())
    .order('expected_arrival_at', { ascending: true });

  if (error) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to load delivery sessions for reconciliation');
  }

  return data || [];
};

const updateDeliverySessionState = async ({ organizationId, deliverySessionId, status, isEscalated }) => {
  const now = new Date().toISOString();
  const updates = {
    status,
    updated_at: now,
    closed_at: status === 'received' || status === 'cancelled' ? now : null,
  };

  if (isEscalated === true) {
    updates.escalated_at = now;
  }

  const { data, error } = await table('delivery_sessions')
    .update(updates)
    .eq('organization_id', organizationId)
    .eq('id', deliverySessionId)
    .select('id,product_id,expected_arrival_at,grace_until,status,escalated_at,closed_at,inventory_applied_quantity,inventory_applied_at')
    .single();

  if (error || !data) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to update delivery session');
  }

  return data;
};

const findProductById = async (productId, organizationId) => {
  let query = table('products')
    .select('id,name,unit,base_unit,unit_price,box_price,is_variable_weight,standard_box_weight')
    .eq('id', productId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { data, error } = await query.single();
  if (error || !data) {
    throw new HttpError(404, 'Product not found');
  }
  return data;
};

const updateProductUnit = async ({ productId, nextUnit, organizationId, unitPrice, boxPrice }) => {
  const updates = {
    unit: nextUnit,
    updated_at: new Date().toISOString(),
  };

  if (Number.isFinite(Number(unitPrice)) && Number(unitPrice) >= 0) {
    updates.unit_price = Number(unitPrice);
  }

  if (Number.isFinite(Number(boxPrice)) && Number(boxPrice) >= 0) {
    updates.box_price = Number(boxPrice);
  }

  let query = table('products').update(updates).eq('id', productId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { error } = await query;
  if (error) {
    throw new HttpError(500, 'Unable to update product inventory');
  }
};

const updateReconciliationStatus = async ({ reconciliationId, status, organizationId }) => {
  let query = table('reconciliation').update({ status }).eq('id', reconciliationId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { error } = await query;
  if (error) {
    throw new HttpError(500, 'Unable to update reconciliation status');
  }
};

const findReconciliationById = async (reconciliationId, organizationId) => {
  let query = table('reconciliation').select('id,product_id,status,delivery_session_id').eq('id', reconciliationId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { data, error } = await query.single();

  if (error || !data) {
    throw new HttpError(404, 'Reconciliation record not found');
  }
  return data;
};

const findLatestOwnerStockEntryForSession = async ({ organizationId, deliverySessionId, productId }) => {
  const { data, error } = await table('stock_in')
    .select('id,quantity,total_weight,unit_price,box_price,unit_cost,total_cost,logistics_fee,reference_note,created_at,updated_at')
    .eq('organization_id', organizationId)
    .eq('delivery_session_id', deliverySessionId)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to fetch latest owner stock entry for session');
  }

  return (data || [])[0] || null;
};

const updateDeliverySessionInventoryApplied = async ({
  organizationId,
  deliverySessionId,
  appliedQuantity,
}) => {
  const payload = {
    inventory_applied_quantity: Number(appliedQuantity || 0),
    inventory_applied_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await table('delivery_sessions')
    .update(payload)
    .eq('organization_id', organizationId)
    .eq('id', deliverySessionId)
    .select('id,product_id,status,inventory_applied_quantity,inventory_applied_at')
    .single();

  if (error || !data) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to update delivery session applied quantity');
  }

  return data;
};

const loadWindowRows = async ({ tableName, organizationId, windowDate, productId, unassignedOnly, select }) => {
  let query = table(tableName)
    .select(select)
    .eq('organization_id', organizationId)
    .eq('logged_date', windowDate);

  if (productId) {
    query = query.eq('product_id', productId);
  }

  if (unassignedOnly) {
    query = query.is('delivery_session_id', null);
  }

  let { data, error } = await query;

  if (error && unassignedOnly && isMissingDeliverySessionSchemaError(error)) {
    let fallbackQuery = table(tableName)
      .select(select)
      .eq('organization_id', organizationId)
      .eq('logged_date', windowDate);
    if (productId) {
      fallbackQuery = fallbackQuery.eq('product_id', productId);
    }
    ({ data, error } = await fallbackQuery);
  }

  return { data, error };
};

const toPositiveNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric;
};

const normalizeUnitType = (value) => String(value || 'kg').trim().toLowerCase();

const parseMetadataWeight = (metadata) => {
  if (!metadata) return 0;
  let parsed = metadata;
  if (typeof metadata === 'string') {
    try {
      parsed = JSON.parse(metadata);
    } catch {
      return 0;
    }
  }
  if (!parsed || typeof parsed !== 'object') return 0;
  return toPositiveNumber(
    parsed.total_weight
    || parsed.totalWeight
    || parsed.invoice_total_weight
    || parsed.invoiceTotalWeight,
  );
};

const normalizeEntryToKg = ({ quantity, unitType, totalWeight, metadata, standardBoxWeight }) => {
  const normalizedUnit = normalizeUnitType(unitType);
  const qty = toPositiveNumber(quantity);
  if (qty <= 0) return 0;

  if (normalizedUnit === 'box' || normalizedUnit === 'carton') {
    const explicitWeight = toPositiveNumber(totalWeight);
    if (explicitWeight > 0) return explicitWeight;
    const metadataWeight = parseMetadataWeight(metadata);
    if (metadataWeight > 0) return metadataWeight;
    if (standardBoxWeight > 0) return qty * standardBoxWeight;
  }

  return qty;
};

const getProductStandardBoxWeight = async ({ organizationId, productId }) => {
  let query = table('products').select('standard_box_weight').eq('id', productId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query.single();
  if (error) {
    if (String(error?.code || '') === 'PGRST116') return 0;
    throw new HttpError(500, 'Unable to fetch product unit conversion config');
  }
  return toPositiveNumber(data?.standard_box_weight);
};

const aggregateStockInQuantity = async ({ organizationId, productId, windowDate, unassignedOnly = false }) => {
  const { data, error } = await loadWindowRows({
    tableName: 'stock_in',
    organizationId,
    productId,
    windowDate,
    unassignedOnly,
    select: 'quantity, unit_type, total_weight',
  });

  if (error) {
    throw new HttpError(500, 'Unable to aggregate owner stock entries');
  }

  const standardBoxWeight = await getProductStandardBoxWeight({ organizationId, productId });
  return (data || []).reduce((sum, row) => (
    sum + normalizeEntryToKg({
      quantity: row.quantity,
      unitType: row.unit_type,
      totalWeight: row.total_weight,
      standardBoxWeight,
    })
  ), 0);
};

const aggregateStaffStockInQuantity = async ({ organizationId, productId, windowDate, unassignedOnly = false }) => {
  const { data, error } = await loadWindowRows({
    tableName: 'stock_in_staff',
    organizationId,
    productId,
    windowDate,
    unassignedOnly,
    select: 'quantity, unit_type, metadata',
  });

  if (error) {
    throw new HttpError(500, 'Unable to aggregate staff stock entries');
  }

  const standardBoxWeight = await getProductStandardBoxWeight({ organizationId, productId });
  return (data || []).reduce((sum, row) => (
    sum + normalizeEntryToKg({
      quantity: row.quantity,
      unitType: row.unit_type,
      metadata: row.metadata,
      standardBoxWeight,
    })
  ), 0);
};

const aggregateStockInQuantityBySession = async ({ organizationId, productId, deliverySessionId }) => {
  const { data, error } = await table('stock_in')
    .select('quantity, unit_type, total_weight')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('delivery_session_id', deliverySessionId);

  if (error) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to aggregate owner stock entries by session');
  }

  const standardBoxWeight = await getProductStandardBoxWeight({ organizationId, productId });
  return (data || []).reduce((sum, row) => (
    sum + normalizeEntryToKg({
      quantity: row.quantity,
      unitType: row.unit_type,
      totalWeight: row.total_weight,
      standardBoxWeight,
    })
  ), 0);
};

const aggregateStaffStockInQuantityBySession = async ({ organizationId, productId, deliverySessionId }) => {
  const { data, error } = await table('stock_in_staff')
    .select('quantity, unit_type, metadata')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('delivery_session_id', deliverySessionId);

  if (error) {
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to aggregate staff stock entries by session');
  }

  const standardBoxWeight = await getProductStandardBoxWeight({ organizationId, productId });
  return (data || []).reduce((sum, row) => (
    sum + normalizeEntryToKg({
      quantity: row.quantity,
      unitType: row.unit_type,
      metadata: row.metadata,
      standardBoxWeight,
    })
  ), 0);
};

const listWindowProductIds = async ({ organizationId, windowDate, unassignedOnly = false }) => {
  const { data: ownerRows, error: ownerError } = await loadWindowRows({
    tableName: 'stock_in',
    organizationId,
    windowDate,
    unassignedOnly,
    select: 'product_id',
  });

  if (ownerError) {
    throw new HttpError(500, 'Unable to load owner stock products for reconciliation');
  }

  const { data: staffRows, error: staffError } = await loadWindowRows({
    tableName: 'stock_in_staff',
    organizationId,
    windowDate,
    unassignedOnly,
    select: 'product_id',
  });

  if (staffError) {
    throw new HttpError(500, 'Unable to load staff stock products for reconciliation');
  }

  const ids = new Set();
  for (const row of ownerRows || []) {
    if (row.product_id) ids.add(String(row.product_id));
  }
  for (const row of staffRows || []) {
    if (row.product_id) ids.add(String(row.product_id));
  }

  return Array.from(ids);
};

const findOpenReconciliationWindow = async ({
  organizationId,
  productId,
  windowDate,
  deliverySessionId = null,
}) => {
  let query = table('reconciliation')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .neq('status', 'resolved')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (deliverySessionId) {
    query = query.eq('delivery_session_id', deliverySessionId);
  } else {
    query = query.eq('window_date', windowDate).is('delivery_session_id', null);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingReconciliationWindowColumnsError(error)) {
      throw new HttpError(400, 'reconciliation window columns are missing. Run backend/sql/010_reconciliation_engine.sql');
    }
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to find reconciliation window');
  }

  return (data || [])[0] || null;
};

const saveReconciliationWindow = async ({
  organizationId,
  productId,
  deliverySessionId = null,
  windowDate,
  ownerQuantity,
  staffQuantity,
  difference,
  status,
  isEscalated,
}) => {
  const existing = await findOpenReconciliationWindow({
    organizationId,
    productId,
    windowDate,
    deliverySessionId,
  });

  const now = new Date().toISOString();
  const payload = {
    organization_id: organizationId,
    product_id: productId,
    delivery_session_id: deliverySessionId || null,
    window_date: windowDate,
    owner_quantity: ownerQuantity,
    staff_quantity: staffQuantity,
    difference,
    status,
    checked_at: now,
    is_escalated: isEscalated,
    escalated_at: isEscalated ? (existing?.escalated_at || now) : null,
    updated_at: now,
  };

  if (existing) {
    const { data, error } = await table('reconciliation')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error || !data) {
      if (isMissingReconciliationWindowColumnsError(error)) {
        throw new HttpError(400, 'reconciliation window columns are missing. Run backend/sql/010_reconciliation_engine.sql');
      }
      if (isMissingDeliverySessionSchemaError(error)) {
        throwDeliverySessionSchemaError();
      }
      throw new HttpError(500, 'Unable to update reconciliation window');
    }
    return data;
  }

  const { data, error } = await table('reconciliation')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    if (isMissingReconciliationWindowColumnsError(error)) {
      throw new HttpError(400, 'reconciliation window columns are missing. Run backend/sql/010_reconciliation_engine.sql');
    }
    if (isMissingDeliverySessionSchemaError(error)) {
      throwDeliverySessionSchemaError();
    }
    throw new HttpError(500, 'Unable to create reconciliation window');
  }

  return data;
};

module.exports = {
  aggregateStaffStockInQuantity,
  aggregateStaffStockInQuantityBySession,
  aggregateStockInQuantity,
  aggregateStockInQuantityBySession,
  createDeliverySession,
  findDeliverySessionById,
  findOpenDeliverySessionForProduct,
  findProductById,
  findReconciliationById,
  findLatestOwnerStockEntryForSession,
  insertStaffStockIn,
  insertStockIn,
  listActiveDeliverySessionsUpToWindow,
  listWindowProductIds,
  saveReconciliationWindow,
  updateDeliverySessionInventoryApplied,
  updateDeliverySessionState,
  updateProductUnit,
  updateReconciliationStatus,
};
