const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const table = (name) => supabase.schema(env.supabaseSchema).from(name);

const listUsers = async () => {
  const { data, error } = await table('users')
    .select(
      `
      id,
      name,
      email,
      role,
      is_active,
      organization_id,
      must_reset_password,
      created_at,
      organizations!organization_id(name)
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw new HttpError(500, 'Unable to fetch users');
  }
  return data || [];
};

const updateUserStatus = async ({ userId, isActive }) => {
  const { data, error } = await table('users')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select('id,name,email,role,is_active,organization_id,must_reset_password')
    .single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to update user status');
  }
  return data;
};

const updateUserPassword = async ({ userId, passwordHash, mustResetPassword }) => {
  const { data, error } = await table('users')
    .update({ password_hash: passwordHash, must_reset_password: mustResetPassword === true })
    .eq('id', userId)
    .select('id,name,email,role,is_active,organization_id,must_reset_password')
    .single();
  if (error || !data) {
    throw new HttpError(500, 'Unable to update user password');
  }
  return data;
};

module.exports = {
  listUsers,
  updateUserStatus,
  updateUserPassword,
};
