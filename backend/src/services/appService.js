const { HttpError } = require('../utils/httpError');
const {
  getProduct,
  getUserProfileById,
  getUserProfile,
  insertProduct,
  insertMiscExpense,
  listAiReports,
  listChartProducts,
  countDailyEntries,
  listMiscExpenseAmounts,
  listMiscExpenses,
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
  listStockExpenseAmounts,
  listStockPurchaseExpenses,
  listStaff,
  markNotificationRead: markNotificationReadRepo,
  updateProduct,
  updateStaffStatus,
} = require('../repositories/appRepository');
const {
  getOrganizationById,
  updateOrganizationInventoryMode,
  normalizeInventoryMode,
  INVENTORY_MODE_DEFAULT,
} = require('../repositories/organizationsRepository');
const { insertAuditLog } = require('../repositories/auditRepository');

const resolveOrganizationId = (actor, requestedOrgId) => {
  if (actor.role === 'superadmin') {
    const orgId = String(requestedOrgId || '').trim();
    if (!orgId) {
      throw new HttpError(400, 'organizationId is required');
    }
    return orgId;
  }
  if (!actor.organization_id) {
    throw new HttpError(400, 'User is missing organization context');
  }
  return actor.organization_id;
};

const getProfile = async ({ actor, userId, organizationId }) => {
  if (actor.role === 'superadmin' && !organizationId) {
    return getUserProfileById({ userId });
  }
  const orgId = resolveOrganizationId(actor, organizationId);
  return getUserProfile({ organizationId: orgId, userId });
};

const getAllProducts = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listProducts({ organizationId: orgId });
};

const getSingleProduct = async ({ actor, organizationId, productId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return getProduct({ organizationId: orgId, productId });
};

const createProduct = async ({ actor, organizationId, payload }) => {
  if (!['admin', 'manager', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin or manager can create products');
  }
  const orgId = resolveOrganizationId(actor, organizationId);
  const { organization_id: _ignored, ...safePayload } = payload || {};
  const record = await insertProduct({ organizationId: orgId, payload: safePayload });
  await insertAuditLog({
    tableName: 'products',
    recordId: record.id,
    action: `Created Product: ${record.name}`,
    changedBy: actor.id,
    organizationId: orgId,
    beforeData: null,
    afterData: record,
  });
  return record;
};

const editProduct = async ({ actor, organizationId, productId, updates }) => {
  const canEditAllFields = ['admin', 'manager', 'superadmin'].includes(actor.role);
  const canEditPriceOnly = actor.role === 'sales';
  if (!canEditAllFields && !canEditPriceOnly) {
    throw new HttpError(403, 'Only admin, manager, or sales can update products');
  }

  const orgId = resolveOrganizationId(actor, organizationId);
  const before = await getProduct({ organizationId: orgId, productId });
  const { organization_id: _ignored, ...rawUpdates } = updates || {};

  let safeUpdates = rawUpdates;
  if (canEditPriceOnly) {
    const priceUpdates = {};
    const hasUnitPrice = Object.prototype.hasOwnProperty.call(rawUpdates, 'unit_price');
    const hasBoxPrice = Object.prototype.hasOwnProperty.call(rawUpdates, 'box_price');

    if (hasUnitPrice) {
      priceUpdates.unit_price = rawUpdates.unit_price;
    }

    if (hasBoxPrice) {
      priceUpdates.box_price = rawUpdates.box_price;
    }

    if (!hasUnitPrice && !hasBoxPrice) {
      throw new HttpError(403, 'Sales users can only update selling prices');
    }

    safeUpdates = priceUpdates;
  }

  const record = await updateProduct({ organizationId: orgId, productId, updates: safeUpdates });

  const isUnitPriceChanged = Number(before.unit_price || 0) !== Number(record.unit_price || 0);
  const isBoxPriceChanged = Number(before.box_price || 0) !== Number(record.box_price || 0);
  const changedPriceFields = [isUnitPriceChanged ? 'unit_price' : null, isBoxPriceChanged ? 'box_price' : null]
    .filter(Boolean)
    .join(', ');

  const action = changedPriceFields
    ? `Updated Product Price (${changedPriceFields}): ${before.name}`
    : `Edited Product: ${before.name}`;

  await insertAuditLog({
    tableName: 'products',
    recordId: record.id,
    action,
    changedBy: actor.id,
    organizationId: orgId,
    beforeData: before,
    afterData: record,
  });
  return record;
};

const archiveProduct = async ({ actor, organizationId, productId }) => {
  if (!['admin', 'manager', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin or manager can archive products');
  }
  const orgId = resolveOrganizationId(actor, organizationId);
  const before = await getProduct({ organizationId: orgId, productId });
  const record = await updateProduct({ organizationId: orgId, productId, updates: { is_active: false } });
  await insertAuditLog({
    tableName: 'products',
    recordId: record.id,
    action: `Archived Product: ${before.name}`,
    changedBy: actor.id,
    organizationId: orgId,
    beforeData: before,
    afterData: record,
  });
  return record;
};

const getAiReports = async ({ actor, organizationId, limit }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listAiReports({ organizationId: orgId, limit });
};

const getPendingReconciliations = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const organization = await getOrganizationById({ organizationId: orgId });
  if (normalizeInventoryMode(organization?.inventory_mode) === 'single_operator') {
    return [];
  }
  return listPendingMismatches({ organizationId: orgId });
};

const getOrganizationSettings = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const organization = await getOrganizationById({ organizationId: orgId });
  return {
    id: organization.id,
    name: organization.name,
    is_active: organization.is_active,
    inventory_mode: normalizeInventoryMode(organization.inventory_mode || INVENTORY_MODE_DEFAULT),
  };
};

const updateOrganizationSettings = async ({ actor, organizationId, inventoryMode }) => {
  if (!['admin', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only superadmin or organization admin can update organization settings');
  }

  const orgId = resolveOrganizationId(actor, organizationId);
  const normalizedMode = normalizeInventoryMode(inventoryMode);
  return updateOrganizationInventoryMode({
    organizationId: orgId,
    inventoryMode: normalizedMode,
  });
};

const getDashboardMetrics = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const [products, stockExpenses, miscExpenses] = await Promise.all([
    listProductUnits({ organizationId: orgId }),
    listStockExpenseAmounts({ organizationId: orgId }),
    listMiscExpenseAmounts({ organizationId: orgId }),
  ]);
  const totalValue = products.reduce((sum, item) => sum + (Number(item.unit || 0) * Number(item.unit_price || 0)), 0);
  const lowStock = products.filter((item) => Number(item.unit || 0) < 10).length;
  const stockExpenseTotal = stockExpenses.reduce(
    (sum, item) => sum + Number(item.total_cost || 0) + Number(item.logistics_fee || 0),
    0,
  );
  const miscExpenseTotal = miscExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    totalValue,
    lowStock,
    totalItems: products.length,
    totalExpenses: stockExpenseTotal + miscExpenseTotal,
  };
};

const getSalesDashboardMetrics = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const sales = await listSalesMetrics({ organizationId: orgId });
  const totalSalesValue = sales.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  const totalUnitsSold = sales.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return { totalSalesValue, totalUnitsSold };
};

const getTodaySalesMetrics = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const todayStartISO = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
  const sales = await listSalesMetrics({
    organizationId: orgId,
    startDate: todayStartISO,
    endDate: new Date().toISOString(),
  });
  const todaySalesValue = sales.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  const todayUnitsSold = sales.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return { todaySalesValue, todayUnitsSold };
};

const getChartData = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const data = await listChartProducts({ organizationId: orgId, limit: 10 });
  return data.map((product) => ({
    name: product.name,
    current_balance: Number(product.unit || 0),
    total_sold: (product.sales || []).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0),
  }));
};

const getUnreadNotifications = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listNotifications({ organizationId: orgId, unreadOnly: true });
};

const markNotificationRead = async ({ actor, organizationId, notificationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  await markNotificationReadRepo({ organizationId: orgId, notificationId });
};

const getDailyEntryStatus = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const today = new Date().toISOString().split('T')[0];
  const { ownerCount, salesCount } = await countDailyEntries({
    organizationId: orgId,
    sinceDate: today,
  });
  return {
    ownerReady: ownerCount > 0,
    salesReady: salesCount > 0,
  };
};

const getInventoryLogs = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listInventoryLogs({ organizationId: orgId });
};

const getProductHistory = async ({ actor, organizationId, productId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  const { stockIn, stockOut } = await listProductHistory({ organizationId: orgId, productId });

  const history = [
    ...stockIn.map((item) => ({
      id: item.id,
      date: item.created_at,
      type: 'IN',
      quantity: item.quantity,
      unit: item.unit_type,
      original_qty: item.input_quantity,
      original_unit: item.input_unit,
      note: item.reference_note || 'Stock Added',
    })),
    ...stockOut.map((item) => ({
      id: item.id,
      date: item.created_at,
      type: 'OUT',
      quantity: item.quantity,
      unit: item.unit_type,
      note: `Sold via ${item.payment_method}`,
    })),
  ];

  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const getStaffList = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listStaff({ organizationId: orgId });
};

const setStaffStatus = async ({ actor, organizationId, userId, isActive }) => {
  if (!['admin', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin can update staff status');
  }
  const orgId = resolveOrganizationId(actor, organizationId);
  await updateStaffStatus({ organizationId: orgId, userId, isActive });
};

const getRecentSales = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listRecentSales({ organizationId: orgId });
};

const getRecentStaffEntries = async ({ actor, organizationId }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  return listRecentStaffEntries({ organizationId: orgId });
};

const getSalesHistory = async ({ actor, organizationId, startDate, endDate }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  if (!startDate || !endDate) {
    throw new HttpError(400, 'startDate and endDate are required');
  }
  return listSalesHistory({ organizationId: orgId, startDate, endDate });
};

const getExpenses = async ({ actor, organizationId, startDate, endDate }) => {
  const orgId = resolveOrganizationId(actor, organizationId);
  if (!startDate || !endDate) {
    throw new HttpError(400, 'startDate and endDate are required');
  }
  const [stockPurchaseExpenses, miscExpenses] = await Promise.all([
    listStockPurchaseExpenses({ organizationId: orgId, startDate, endDate }),
    listMiscExpenses({ organizationId: orgId, startDate, endDate }),
  ]);

  const normalizedPurchases = stockPurchaseExpenses.map((entry) => ({
    id: entry.id,
    expense_type: 'stock_purchase',
    expense_date: entry.logged_date || String(entry.created_at || '').slice(0, 10),
    created_at: entry.created_at,
    description: entry.products?.name || 'Stock purchase',
    category: entry.products?.category || 'inventory',
    quantity: Number(entry.input_quantity || entry.quantity || 0),
    unit_type: entry.input_unit || entry.unit_type || 'kg',
    unit_cost: Number(entry.unit_cost || 0),
    goods_cost: Number(entry.total_cost || 0),
    logistics_fee: Number(entry.logistics_fee || 0),
    amount: Number(entry.total_cost || 0) + Number(entry.logistics_fee || 0),
    notes: entry.reference_note || '',
    products: entry.products || null,
    created_by_name: null,
  }));

  const normalizedMiscExpenses = miscExpenses.map((entry) => ({
    id: entry.id,
    expense_type: 'misc',
    expense_date: entry.expense_date,
    created_at: entry.created_at,
    description: entry.description,
    category: entry.category || 'miscellaneous',
    quantity: null,
    unit_type: null,
    unit_cost: null,
    goods_cost: 0,
    logistics_fee: 0,
    amount: Number(entry.amount || 0),
    notes: entry.notes || '',
    products: null,
    created_by_name: entry.users?.name || null,
  }));

  return [...normalizedPurchases, ...normalizedMiscExpenses].sort((a, b) => {
    const left = new Date(b.created_at || b.expense_date).getTime();
    const right = new Date(a.created_at || a.expense_date).getTime();
    return left - right;
  });
};

const createExpense = async ({ actor, organizationId, payload }) => {
  if (!['admin', 'manager', 'superadmin'].includes(actor.role)) {
    throw new HttpError(403, 'Only admin or manager can record expenses');
  }

  const orgId = resolveOrganizationId(actor, organizationId);
  const description = String(payload?.description || '').trim();
  const category = String(payload?.category || '').trim();
  const amount = Number(payload?.amount);
  const expenseDate = String(payload?.expenseDate || '').trim();
  const notes = String(payload?.notes || '').trim();

  if (!description || !category || !expenseDate || !Number.isFinite(amount)) {
    throw new HttpError(400, 'description, category, amount and expenseDate are required');
  }

  if (amount <= 0) {
    throw new HttpError(400, 'Expense amount must be greater than zero');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    throw new HttpError(400, 'expenseDate must be a valid date');
  }

  const record = await insertMiscExpense({
    organizationId: orgId,
    createdBy: actor.id,
    payload: {
      description,
      category,
      amount,
      expenseDate,
      notes,
    },
  });

  await insertAuditLog({
    tableName: 'expenses',
    recordId: record.id,
    action: `Created Expense: ${description}`,
    changedBy: actor.id,
    organizationId: orgId,
    beforeData: null,
    afterData: record,
  });

  return {
    id: record.id,
    expense_type: 'misc',
    expense_date: record.expense_date,
    created_at: record.created_at,
    description: record.description,
    category: record.category || 'miscellaneous',
    quantity: null,
    unit_type: null,
    unit_cost: null,
    goods_cost: 0,
    logistics_fee: 0,
    amount: Number(record.amount || 0),
    notes: record.notes || '',
    products: null,
    created_by_name: record.users?.name || null,
  };
};

module.exports = {
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
  updateOrganizationSettings,
  getProfile,
  markNotificationRead,
  setStaffStatus,
};
