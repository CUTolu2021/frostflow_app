const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const table = (name) => supabase.schema(env.supabaseSchema).from(name);

const isMissingReconciliationWindowColumnsError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes("window_date") ||
    message.includes("is_escalated") ||
    message.includes("escalated_at")
  );
};

const insertStockIn = async (payload) => {
  const { data, error } = await table('stock_in').insert(payload).select('*').single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to add stock entry');
  }
  return data;
};

const insertStaffStockIn = async (payload) => {
  const { data, error } = await table('stock_in_staff').insert(payload).select('*').single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to add staff stock entry');
  }
  return data;
};

const findProductById = async (productId, organizationId) => {
  let query = table('products').select('id,name,unit').eq('id', productId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { data, error } = await query.single();
  if (error || !data) {
    throw new HttpError(404, 'Product not found');
  }
  return data;
};

const updateProductUnit = async ({ productId, nextUnit, organizationId }) => {
  let query = table('products').update({ unit: nextUnit }).eq('id', productId);
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
  let query = table('reconciliation').select('id,product_id,status').eq('id', reconciliationId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { data, error } = await query.single();

  if (error || !data) {
    throw new HttpError(404, 'Reconciliation record not found');
  }
  return data;
};

const aggregateStockInQuantity = async ({ organizationId, productId, windowDate }) => {
  const { data, error } = await table('stock_in')
    .select('quantity')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('logged_date', windowDate);

  if (error) {
    throw new HttpError(500, 'Unable to aggregate owner stock entries');
  }

  return (data || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
};

const aggregateStaffStockInQuantity = async ({ organizationId, productId, windowDate }) => {
  const { data, error } = await table('stock_in_staff')
    .select('quantity')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('logged_date', windowDate);

  if (error) {
    throw new HttpError(500, 'Unable to aggregate staff stock entries');
  }

  return (data || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
};

const listWindowProductIds = async ({ organizationId, windowDate }) => {
  const { data: ownerRows, error: ownerError } = await table('stock_in')
    .select('product_id')
    .eq('organization_id', organizationId)
    .eq('logged_date', windowDate);

  if (ownerError) {
    throw new HttpError(500, 'Unable to load owner stock products for reconciliation');
  }

  const { data: staffRows, error: staffError } = await table('stock_in_staff')
    .select('product_id')
    .eq('organization_id', organizationId)
    .eq('logged_date', windowDate);

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

const findOpenReconciliationWindow = async ({ organizationId, productId, windowDate }) => {
  const { data, error } = await table('reconciliation')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('product_id', productId)
    .eq('window_date', windowDate)
    .neq('status', 'resolved')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingReconciliationWindowColumnsError(error)) {
      throw new HttpError(400, 'reconciliation window columns are missing. Run backend/sql/010_reconciliation_engine.sql');
    }
    throw new HttpError(500, 'Unable to find reconciliation window');
  }

  return (data || [])[0] || null;
};

const saveReconciliationWindow = async ({
  organizationId,
  productId,
  windowDate,
  ownerQuantity,
  staffQuantity,
  difference,
  status,
  isEscalated,
}) => {
  const payload = {
    organization_id: organizationId,
    product_id: productId,
    window_date: windowDate,
    owner_quantity: ownerQuantity,
    staff_quantity: staffQuantity,
    difference,
    status,
    checked_at: new Date().toISOString(),
    is_escalated: isEscalated,
    escalated_at: isEscalated ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const existing = await findOpenReconciliationWindow({
    organizationId,
    productId,
    windowDate,
  });

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
    throw new HttpError(500, 'Unable to create reconciliation window');
  }

  return data;
};

module.exports = {
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
};
