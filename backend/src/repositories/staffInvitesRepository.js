const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const table = () => supabase.schema(env.supabaseSchema).from('staff_invites');

const isMissingStaffInvitesTableError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes("could not find the table 'staff_invites'") ||
    message.includes('relation "frostflow_data.staff_invites" does not exist') ||
    message.includes('staff_invites does not exist')
  );
};

const upsertStaffInvite = async ({
  organizationId,
  invitedEmail,
  role,
  inviteTokenHash,
  expiresAt,
  createdBy,
}) => {
  // Create the new invite first. Rotation of older invites is best-effort.
  const nowIso = new Date().toISOString();
  const { data, error } = await table()
    .insert({
      organization_id: organizationId,
      invited_email: invitedEmail,
      role,
      invite_token_hash: inviteTokenHash,
      expires_at: expiresAt,
      created_by: createdBy,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (error || !data) {
    if (isMissingStaffInvitesTableError(error)) {
      throw new HttpError(400, 'staff_invites table is missing. Run backend/sql/008_staff_invites.sql');
    }
    throw new HttpError(500, `Unable to create staff invite: ${error?.message || 'unknown error'}`);
  }

  const { error: revokeError } = await table()
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .eq('invited_email', invitedEmail)
    .neq('id', data.id)
    .is('used_at', null)
    .is('revoked_at', null);

  if (revokeError) {
    // Do not fail invite creation if cleanup of old invites fails.
    console.warn('[staff_invites] Unable to rotate previous invites:', revokeError.message || revokeError);
  }
  return data;
};

const findActiveInviteByTokenHash = async ({ inviteTokenHash }) => {
  const { data, error } = await table()
    .select('*')
    .eq('invite_token_hash', inviteTokenHash)
    .is('used_at', null)
    .is('revoked_at', null)
    .single();

  if (error || !data) return null;
  return data;
};

const consumeInvite = async ({ inviteId, usedBy }) => {
  const { error } = await table()
    .update({
      used_by: usedBy,
      used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', inviteId)
    .is('used_at', null)
    .is('revoked_at', null);

  if (error) {
    throw new HttpError(500, 'Unable to consume invite');
  }
};

module.exports = {
  upsertStaffInvite,
  findActiveInviteByTokenHash,
  consumeInvite,
};
