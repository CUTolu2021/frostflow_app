const { randomUUID } = require('crypto');
const { supabase } = require('../src/config/supabase');
const { env } = require('../src/config/env');
const { hashPassword } = require('../src/utils/security');

const DUMMY_USERS = [
  { name: 'Admin Test 1', email: 'admin1@frostflow.test', role: 'admin', password: 'Admin@2026' },
  { name: 'Admin Test 2', email: 'admin2@frostflow.test', role: 'admin', password: 'Admin@2026' },
  { name: 'Manager Test 1', email: 'manager1@frostflow.test', role: 'manager', password: 'Manager@2026' },
  { name: 'Manager Test 2', email: 'manager2@frostflow.test', role: 'manager', password: 'Manager@2026' },
  { name: 'Sales Test 1', email: 'sales1@frostflow.test', role: 'sales', password: 'Sales@2026' },
  { name: 'Sales Test 2', email: 'sales2@frostflow.test', role: 'sales', password: 'Sales@2026' },
];

const usersTable = () => supabase.schema(env.supabaseSchema).from('users');

const hasPasswordHashColumn = async () => {
  const { error } = await usersTable().select('password_hash').limit(1);
  if (!error) return true;

  const message = String(error.message || '').toLowerCase();
  if (
    message.includes("could not find the 'password_hash' column") ||
    message.includes('column users.password_hash does not exist') ||
    message.includes('password_hash does not exist')
  ) {
    return false;
  }

  throw new Error(`Schema check failed: ${error.message}`);
};

const upsertDummyUser = async ({ name, email, role, password, canStorePasswordHash }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const passwordHash = canStorePasswordHash ? await hashPassword(password) : null;

  const { data: existing, error: findError } = await usersTable()
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (findError) {
    throw new Error(`Lookup failed for ${normalizedEmail}: ${findError.message}`);
  }

  if (existing?.id) {
    const { error: updateError } = await usersTable()
      .update({
        name,
        role,
        is_active: true,
        ...(canStorePasswordHash ? { password_hash: passwordHash } : {}),
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(`Update failed for ${normalizedEmail}: ${updateError.message}`);
    }

    return 'updated';
  }

  const { error: insertError } = await usersTable().insert({
    id: randomUUID(),
    name,
    email: normalizedEmail,
    role,
    is_active: true,
    ...(canStorePasswordHash ? { password_hash: passwordHash } : {}),
  });

  if (insertError) {
    throw new Error(`Insert failed for ${normalizedEmail}: ${insertError.message}`);
  }

  return 'created';
};

const main = async () => {
  const canStorePasswordHash = await hasPasswordHashColumn();
  let created = 0;
  let updated = 0;

  if (!canStorePasswordHash) {
    console.warn("Warning: users.password_hash is missing. Dummy users will be created without stored password hashes.");
    console.warn('Run backend/sql/001_auth_password_hash.sql when ready.');
  }

  for (const user of DUMMY_USERS) {
    const action = await upsertDummyUser({
      ...user,
      canStorePasswordHash,
    });
    if (action === 'created') created += 1;
    if (action === 'updated') updated += 1;
    console.log(`${action.toUpperCase()}: ${user.email} (${user.role})`);
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
