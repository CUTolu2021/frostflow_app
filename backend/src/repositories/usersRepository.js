const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const usersTable = () => supabase.schema(env.supabaseSchema).from('users');

const isMissingPasswordHashColumnError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes("could not find the 'password_hash' column") ||
    message.includes('column users.password_hash does not exist') ||
    message.includes('password_hash does not exist')
  );
};

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  organization_id: user.organization_id || null,
  organization_name: user.organization_name || null,
  is_active: user.is_active !== false,
  must_reset_password: user.must_reset_password === true,
});

const findByEmail = async (email) => {
  const { data, error } = await usersTable()
    .select('id,email,name,role,is_active,password_hash,organization_id,must_reset_password')
    .eq('email', email)
    .single();

  if (!error && data) return data;

  if (isMissingPasswordHashColumnError(error)) {
    const { data: fallbackData, error: fallbackError } = await usersTable()
      .select('id,email,name,role,is_active,organization_id,must_reset_password')
      .eq('email', email)
      .single();

    if (fallbackError || !fallbackData) return null;
    return {
      ...fallbackData,
      password_hash: null,
    };
  }

  if (error || !data) return null;
  return data;
};

const findById = async (id) => {
  const { data, error } = await usersTable()
    .select('id,email,name,role,is_active,organization_id,must_reset_password')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return sanitizeUser(data);
};

const findRawById = async (id) => {
  const { data, error } = await usersTable()
    .select('id,email,name,role,is_active,organization_id,password_hash,must_reset_password')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data;
};

const createUser = async ({ name, email, role, passwordHash, organizationId, mustResetPassword }) => {
  let data = null;
  let error = null;
  const payload = {
    name,
    email,
    role,
    is_active: true,
    password_hash: passwordHash,
    organization_id: organizationId || null,
    must_reset_password: mustResetPassword === true,
  };

  ({ data, error } = await usersTable()
    .insert(payload)
    .select('id,email,name,role,is_active,organization_id,must_reset_password')
    .single());

  if (isMissingPasswordHashColumnError(error)) {
    ({ data, error } = await usersTable()
      .insert({
        name,
        email,
        role,
        is_active: true,
        organization_id: organizationId || null,
        must_reset_password: mustResetPassword === true,
      })
      .select('id,email,name,role,is_active,organization_id,must_reset_password')
      .single());
  }

  if (error) {
    if (String(error.message || '').toLowerCase().includes('duplicate')) {
      throw new HttpError(409, 'A user with this email already exists');
    }
    throw new HttpError(500, `Unable to create staff user: ${error.message || 'unknown error'}`);
  }

  return sanitizeUser(data);
};

const createStaffUser = async ({ name, email, role, passwordHash, organizationId, mustResetPassword }) =>
  createUser({
    name,
    email,
    role,
    passwordHash,
    organizationId,
    mustResetPassword,
  });

const updatePasswordHash = async ({ userId, passwordHash }) => {
  const { data, error } = await usersTable()
    .update({ password_hash: passwordHash })
    .eq('id', userId)
    .select('id,email,name,role,is_active,organization_id,must_reset_password')
    .single();

  if (error || !data) {
    if (isMissingPasswordHashColumnError(error)) {
      throw new HttpError(400, 'users.password_hash is missing. Run backend/sql/001_auth_password_hash.sql');
    }
    if (String(error?.code || '') === 'PGRST116') {
      throw new HttpError(404, 'User not found');
    }
    throw new HttpError(500, 'Unable to update password');
  }

  return sanitizeUser(data);
};

const findIdByEmail = async (email) => {
  const { data, error } = await usersTable().select('id').eq('email', email).single();
  if (error || !data) return null;
  return data.id;
};

const updatePasswordAndResetFlag = async ({ userId, passwordHash, mustResetPassword }) => {
  const { data, error } = await usersTable()
    .update({ password_hash: passwordHash, must_reset_password: mustResetPassword === true })
    .eq('id', userId)
    .select('id,email,name,role,is_active,organization_id,must_reset_password')
    .single();

  if (error || !data) {
    if (isMissingPasswordHashColumnError(error)) {
      throw new HttpError(400, 'users.password_hash is missing. Run backend/sql/001_auth_password_hash.sql');
    }
    if (String(error?.code || '') === 'PGRST116') {
      throw new HttpError(404, 'User not found');
    }
    throw new HttpError(500, 'Unable to update password');
  }

  return sanitizeUser(data);
};

module.exports = {
  createUser,
  createStaffUser,
  findByEmail,
  findById,
  findRawById,
  findIdByEmail,
  sanitizeUser,
  updatePasswordHash,
  updatePasswordAndResetFlag,
};
