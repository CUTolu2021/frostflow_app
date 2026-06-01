const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const table = () => supabase.schema(env.supabaseSchema).from('organizations');
const INVENTORY_MODE_DEFAULT = 'dual_control';

const normalizeInventoryMode = (value) => (
  String(value || INVENTORY_MODE_DEFAULT).trim().toLowerCase() === 'single_operator'
    ? 'single_operator'
    : INVENTORY_MODE_DEFAULT
);

const isMissingInventoryModeColumnError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('inventory_mode') && (
      message.includes('does not exist')
      || message.includes('could not find the')
      || message.includes('column')
    )
  );
};

const withModeFallback = (row) => ({
  ...row,
  inventory_mode: normalizeInventoryMode(row?.inventory_mode),
});

const createOrganization = async ({ name }) => {
  let { data, error } = await table().insert({ name }).select('id,name,created_at,inventory_mode').single();
  if (error && isMissingInventoryModeColumnError(error)) {
    ({ data, error } = await table().insert({ name }).select('id,name,created_at').single());
  }
  if (error || !data) {
    throw new HttpError(500, 'Unable to create organization');
  }
  return withModeFallback(data);
};

const listOrganizations = async () => {
  let { data, error } = await table()
    .select('id,name,is_active,deleted_at,created_at,inventory_mode')
    .order('created_at', { ascending: false });
  if (error && isMissingInventoryModeColumnError(error)) {
    ({ data, error } = await table()
      .select('id,name,is_active,deleted_at,created_at')
      .order('created_at', { ascending: false }));
  }
  if (error) {
    throw new HttpError(500, 'Unable to fetch organizations');
  }
  return (data || []).map(withModeFallback);
};

const updateOrganizationStatus = async ({ organizationId, isActive }) => {
  let { data, error } = await table()
    .update({ is_active: isActive })
    .eq('id', organizationId)
    .select('id,name,is_active,deleted_at,created_at,inventory_mode')
    .single();
  if (error && isMissingInventoryModeColumnError(error)) {
    ({ data, error } = await table()
      .update({ is_active: isActive })
      .eq('id', organizationId)
      .select('id,name,is_active,deleted_at,created_at')
      .single());
  }
  if (error || !data) {
    throw new HttpError(500, 'Unable to update organization status');
  }
  return withModeFallback(data);
};

const softDeleteOrganization = async ({ organizationId }) => {
  let { data, error } = await table()
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', organizationId)
    .select('id,name,is_active,deleted_at,created_at,inventory_mode')
    .single();
  if (error && isMissingInventoryModeColumnError(error)) {
    ({ data, error } = await table()
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('id', organizationId)
      .select('id,name,is_active,deleted_at,created_at')
      .single());
  }
  if (error || !data) {
    throw new HttpError(500, 'Unable to soft delete organization');
  }
  return withModeFallback(data);
};

const deleteOrganization = async ({ organizationId }) => {
  const { error } = await table().delete().eq('id', organizationId);
  if (error) {
    throw new HttpError(500, 'Unable to delete organization');
  }
};

const deleteOrganizationCascade = async ({ organizationId }) => {
  const schema = env.supabaseSchema;
  const tables = [
    'audit_logs',
    'notifications',
    'ai_stock_reports',
    'reconciliation',
    'sales',
    'stock_in_staff',
    'stock_in',
    'expenses',
    'products',
    'users',
  ];

  for (const tableName of tables) {
    const { error } = await supabase
      .schema(schema)
      .from(tableName)
      .delete()
      .eq('organization_id', organizationId);
    if (error) {
      throw new HttpError(500, `Unable to delete ${tableName} for organization`);
    }
  }

  await deleteOrganization({ organizationId });
};

const countUsersByOrg = async ({ organizationId }) => {
  const { count, error } = await supabase
    .schema(env.supabaseSchema)
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);
  if (error) {
    throw new HttpError(500, 'Unable to count organization users');
  }
  return count || 0;
};

const getOrganizationById = async ({ organizationId }) => {
  let { data, error } = await table()
    .select('id,name,is_active,deleted_at,inventory_mode')
    .eq('id', organizationId)
    .single();
  if (error && isMissingInventoryModeColumnError(error)) {
    ({ data, error } = await table()
      .select('id,name,is_active,deleted_at')
      .eq('id', organizationId)
      .single());
  }
  if (error || !data) {
    throw new HttpError(404, 'Organization not found');
  }
  return withModeFallback(data);
};

const updateOrganizationInventoryMode = async ({ organizationId, inventoryMode }) => {
  const normalizedMode = normalizeInventoryMode(inventoryMode);
  const { data, error } = await table()
    .update({ inventory_mode: normalizedMode })
    .eq('id', organizationId)
    .select('id,name,is_active,deleted_at,created_at,inventory_mode')
    .single();
  if (error || !data) {
    if (isMissingInventoryModeColumnError(error)) {
      throw new HttpError(
        400,
        'inventory_mode column is missing. Run backend/sql/012_inventory_mode.sql',
      );
    }
    throw new HttpError(500, 'Unable to update organization inventory mode');
  }
  return withModeFallback(data);
};

module.exports = {
  createOrganization,
  listOrganizations,
  updateOrganizationStatus,
  deleteOrganization,
  deleteOrganizationCascade,
  softDeleteOrganization,
  countUsersByOrg,
  getOrganizationById,
  updateOrganizationInventoryMode,
  normalizeInventoryMode,
  INVENTORY_MODE_DEFAULT,
};
