const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const table = (name) => supabase.schema(env.supabaseSchema).from(name);

const isNotificationsSchemaError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes("relation \"frostflow_data.notifications\" does not exist") ||
    message.includes("could not find the table 'notifications'") ||
    message.includes("column notifications.organization_id does not exist") ||
    message.includes("column notifications.is_read does not exist") ||
    message.includes("column notifications.created_at does not exist")
  );
};

const isMissingDeliverySessionSchemaError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('delivery_session_id')
    || message.includes("relation \"frostflow_data.delivery_sessions\" does not exist")
    || message.includes("could not find the table 'delivery_sessions'")
  );
};

const selectSingle = async (query, message) => {
  const { data, error } = await query.single();
  if (error || !data) {
    throw new HttpError(404, message);
  }
  return data;
};

const listProducts = async ({ organizationId }) => {
  const { data, error } = await table('products')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) {
    throw new HttpError(500, 'Unable to fetch products');
  }
  return data || [];
};

const getProduct = async ({ organizationId, productId }) =>
  selectSingle(
    table('products').select('*').eq('organization_id', organizationId).eq('id', productId),
    'Product not found',
  );

const insertProduct = async ({ organizationId, payload }) => {
  const { data, error } = await table('products')
    .insert({ ...payload, organization_id: organizationId })
    .select('*')
    .single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to add product');
  }
  return data;
};

const updateProduct = async ({ organizationId, productId, updates }) =>
  selectSingle(
    table('products').update(updates).eq('organization_id', organizationId).eq('id', productId).select('*'),
    'Product not found',
  );

const listAiReports = async ({ organizationId, limit = 1 }) => {
  const { data, error } = await table('ai_stock_reports')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new HttpError(500, 'Unable to fetch AI reports');
  }
  return data || [];
};

const listPendingMismatches = async ({ organizationId }) => {
  const { data, error } = await table('reconciliation')
    .select('*, products!product_id(name, unit)')
    .eq('organization_id', organizationId)
    .neq('status', 'match')
    .neq('status', 'resolved')
    .order('is_escalated', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new HttpError(500, 'Unable to fetch mismatches');
  }

  const mismatches = data || [];
  const resolveUnitsForRow = async (row, tableName) => {
    let query = table(tableName)
      .select('unit_type')
      .eq('organization_id', organizationId)
      .eq('product_id', row.product_id);

    if (row.delivery_session_id) {
      query = query.eq('delivery_session_id', row.delivery_session_id);
    } else if (row.window_date) {
      query = query.eq('logged_date', row.window_date).is('delivery_session_id', null);
    } else {
      return [];
    }

    let { data: rows, error: rowError } = await query;

    if (
      rowError
      && !row.delivery_session_id
      && row.window_date
      && isMissingDeliverySessionSchemaError(rowError)
    ) {
      const fallback = await table(tableName)
        .select('unit_type')
        .eq('organization_id', organizationId)
        .eq('product_id', row.product_id)
        .eq('logged_date', row.window_date);
      rows = fallback.data;
      rowError = fallback.error;
    }

    if (rowError) {
      throw new HttpError(500, 'Unable to fetch mismatch unit details');
    }

    const unique = new Set();
    for (const unitRow of rows || []) {
      const normalized = String(unitRow?.unit_type || 'kg').trim().toLowerCase();
      if (normalized) unique.add(normalized);
    }
    return Array.from(unique);
  };

  const enriched = await Promise.all(
    mismatches.map(async (row) => {
      const [ownerUnits, staffUnits] = await Promise.all([
        resolveUnitsForRow(row, 'stock_in'),
        resolveUnitsForRow(row, 'stock_in_staff'),
      ]);
      return {
        ...row,
        owner_units: ownerUnits,
        staff_units: staffUnits,
        normalized_unit: 'kg',
      };
    }),
  );

  return enriched;
};

const listProductUnits = async ({ organizationId }) => {
  const { data, error } = await table('products')
    .select('unit, unit_price')
    .eq('organization_id', organizationId)
    .eq('is_active', true);
  if (error) {
    throw new HttpError(500, 'Unable to fetch product metrics');
  }
  return data || [];
};

const listSalesMetrics = async ({ organizationId, startDate, endDate }) => {
  let query = table('sales').select('quantity, total_price').eq('organization_id', organizationId);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  const { data, error } = await query;
  if (error) {
    throw new HttpError(500, 'Unable to fetch sales metrics');
  }
  return data || [];
};

const listChartProducts = async ({ organizationId, limit = 10 }) => {
  const { data, error } = await table('products')
    .select(
      `
      name,
      unit,
      sales (
        quantity
      )
    `,
    )
    .eq('organization_id', organizationId)
    .limit(limit);
  if (error) {
    throw new HttpError(500, 'Unable to fetch chart data');
  }
  return data || [];
};

const listNotifications = async ({ organizationId, unreadOnly }) => {
  let query = table('notifications')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (unreadOnly) {
    query = query.eq('is_read', false);
  }
  const { data, error } = await query;
  if (error) {
    if (isNotificationsSchemaError(error)) {
      return [];
    }
    throw new HttpError(500, 'Unable to fetch notifications');
  }
  return data || [];
};

const markNotificationRead = async ({ organizationId, notificationId }) => {
  const { error } = await table('notifications')
    .update({ is_read: true })
    .eq('organization_id', organizationId)
    .eq('id', notificationId);
  if (error) {
    if (isNotificationsSchemaError(error)) {
      return;
    }
    throw new HttpError(500, 'Unable to update notification');
  }
};

const countDailyEntries = async ({ organizationId, sinceDate }) => {
  const { count: ownerCount, error: ownerError } = await table('stock_in')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('created_at', sinceDate);
  if (ownerError) {
    throw new HttpError(500, 'Unable to fetch stock-in status');
  }

  const { count: salesCount, error: salesError } = await table('stock_in_staff')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .gte('created_at', sinceDate);
  if (salesError) {
    throw new HttpError(500, 'Unable to fetch staff stock-in status');
  }

  return { ownerCount: ownerCount || 0, salesCount: salesCount || 0 };
};

const listInventoryLogs = async ({ organizationId }) => {
  const { data, error } = await table('stock_in')
    .select('*, products!product_id(name, category, unit, is_variable_weight, standard_box_weight)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  if (error) {
    throw new HttpError(500, 'Unable to fetch inventory logs');
  }
  return data || [];
};

const listProductHistory = async ({ organizationId, productId }) => {
  const { data: stockIn, error: errorIn } = await table('stock_in')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('product_id', productId);

  if (errorIn) {
    throw new HttpError(500, 'Unable to fetch stock-in history');
  }

  const { data: stockOut, error: errorOut } = await table('sales')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('product_id', productId);

  if (errorOut) {
    throw new HttpError(500, 'Unable to fetch sales history');
  }

  return { stockIn: stockIn || [], stockOut: stockOut || [] };
};

const listStaff = async ({ organizationId }) => {
  const { data, error } = await table('users')
    .select('*')
    .eq('organization_id', organizationId)
    .neq('role', 'owner')
    .order('created_at', { ascending: false });
  if (error) {
    throw new HttpError(500, 'Unable to fetch staff');
  }
  return data || [];
};

const updateStaffStatus = async ({ organizationId, userId, isActive }) => {
  const { error } = await table('users')
    .update({ is_active: isActive })
    .eq('organization_id', organizationId)
    .eq('id', userId);
  if (error) {
    throw new HttpError(500, 'Unable to update staff status');
  }
};

const listRecentSales = async ({ organizationId, limit = 50 }) => {
  const { data, error } = await table('sales')
    .select('*, products!product_id(name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new HttpError(500, 'Unable to fetch recent sales');
  }
  return data || [];
};

const listRecentStaffEntries = async ({ organizationId, limit = 5 }) => {
  const { data, error } = await table('stock_in_staff')
    .select('*, products!product_id(name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new HttpError(500, 'Unable to fetch staff stock entries');
  }
  return data || [];
};

const listSalesHistory = async ({ organizationId, startDate, endDate }) => {
  const { data, error } = await table('sales')
    .select('*, products!product_id(name), users!recorded_by(name)')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });

  if (error) {
    throw new HttpError(500, 'Unable to fetch sales history');
  }
  return data || [];
};

const listExpenses = async ({ organizationId, startDate, endDate }) => {
  const { data, error } = await table('stock_in')
    .select('*, products (name, category)')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });

  if (error) {
    throw new HttpError(500, 'Unable to fetch expenses');
  }
  return data || [];
};

const getUserProfile = async ({ organizationId, userId }) =>
  selectSingle(
    table('users').select('*').eq('organization_id', organizationId).eq('id', userId),
    'User not found',
  );

const getUserProfileById = async ({ userId }) =>
  selectSingle(table('users').select('*').eq('id', userId), 'User not found');

module.exports = {
  getProduct,
  getUserProfileById,
  getUserProfile,
  insertProduct,
  listAiReports,
  listChartProducts,
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
  countDailyEntries,
  markNotificationRead,
  updateProduct,
  updateStaffStatus,
};
