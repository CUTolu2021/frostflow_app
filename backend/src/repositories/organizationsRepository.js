const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const table = () => supabase.schema(env.supabaseSchema).from('organizations');

const createOrganization = async ({ name }) => {
  const { data, error } = await table().insert({ name }).select('id,name,created_at').single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to create organization');
  }
  return data;
};

const listOrganizations = async () => {
  const { data, error } = await table()
    .select('id,name,is_active,deleted_at,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    throw new HttpError(500, 'Unable to fetch organizations');
  }
  return data || [];
};

const updateOrganizationStatus = async ({ organizationId, isActive }) => {
  const { data, error } = await table()
    .update({ is_active: isActive })
    .eq('id', organizationId)
    .select('id,name,is_active,deleted_at,created_at')
    .single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to update organization status');
  }
  return data;
};

const softDeleteOrganization = async ({ organizationId }) => {
  const { data, error } = await table()
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', organizationId)
    .select('id,name,is_active,deleted_at,created_at')
    .single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to soft delete organization');
  }
  return data;
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
  const { data, error } = await table()
    .select('id,name,is_active,deleted_at')
    .eq('id', organizationId)
    .single();
  if (error || !data) {
    throw new HttpError(404, 'Organization not found');
  }
  return data;
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
};
