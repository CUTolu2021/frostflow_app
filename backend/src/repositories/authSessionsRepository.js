const { randomUUID } = require('crypto');
const { supabase } = require('../config/supabase');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');

const sessionsTable = () => supabase.schema(env.supabaseSchema).from('auth_sessions');
const memorySessions = new Map();
let useMemorySessionStore = false;

const isMissingAuthSessionsTableError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    (message.includes('auth_sessions') && message.includes('does not exist')) ||
    message.includes("could not find the table 'auth_sessions'") ||
    message.includes('schema cache')
  );
};

const enableMemorySessionStore = () => {
  useMemorySessionStore = true;
};

const listMemorySessions = () => Array.from(memorySessions.values());

const createMemorySession = ({ userId, refreshTokenHash, expiresAt, userAgent, ipAddress }) => {
  const session = {
    id: randomUUID(),
    user_id: userId,
    refresh_token_hash: refreshTokenHash,
    expires_at: expiresAt,
    user_agent: userAgent || null,
    ip_address: ipAddress || null,
    is_revoked: false,
    revoked_at: null,
    rotated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  memorySessions.set(session.id, session);
  return session;
};

const createSession = async ({ userId, refreshTokenHash, expiresAt, userAgent, ipAddress }) => {
  if (useMemorySessionStore) {
    return createMemorySession({ userId, refreshTokenHash, expiresAt, userAgent, ipAddress });
  }

  const { data, error } = await sessionsTable()
    .insert({
      user_id: userId,
      refresh_token_hash: refreshTokenHash,
      expires_at: expiresAt,
      user_agent: userAgent || null,
      ip_address: ipAddress || null,
      is_revoked: false,
    })
    .select('id,user_id,expires_at,is_revoked')
    .single();

  if (isMissingAuthSessionsTableError(error)) {
    enableMemorySessionStore();
    return createMemorySession({ userId, refreshTokenHash, expiresAt, userAgent, ipAddress });
  }

  if (error || !data) {
    throw new HttpError(500, 'Unable to create auth session');
  }

  return data;
};

const findActiveSessionByTokenHash = async (refreshTokenHash) => {
  if (useMemorySessionStore) {
    const session = listMemorySessions().find(
      (entry) => entry.refresh_token_hash === refreshTokenHash && entry.is_revoked === false,
    );
    return session || null;
  }

  const { data, error } = await sessionsTable()
    .select('*')
    .eq('refresh_token_hash', refreshTokenHash)
    .eq('is_revoked', false)
    .single();

  if (isMissingAuthSessionsTableError(error)) {
    enableMemorySessionStore();
    const session = listMemorySessions().find(
      (entry) => entry.refresh_token_hash === refreshTokenHash && entry.is_revoked === false,
    );
    return session || null;
  }

  if (error || !data) return null;
  return data;
};

const rotateSessionToken = async ({ sessionId, nextRefreshTokenHash, nextExpiresAt }) => {
  if (useMemorySessionStore) {
    const session = memorySessions.get(sessionId);
    if (!session || session.is_revoked) {
      throw new HttpError(401, 'Invalid session rotation');
    }
    session.refresh_token_hash = nextRefreshTokenHash;
    session.expires_at = nextExpiresAt;
    session.rotated_at = new Date().toISOString();
    session.updated_at = new Date().toISOString();
    memorySessions.set(session.id, session);
    return session;
  }

  const { data, error } = await sessionsTable()
    .update({
      refresh_token_hash: nextRefreshTokenHash,
      expires_at: nextExpiresAt,
      rotated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('is_revoked', false)
    .select('*')
    .single();

  if (isMissingAuthSessionsTableError(error)) {
    enableMemorySessionStore();
    const session = memorySessions.get(sessionId);
    if (!session || session.is_revoked) {
      throw new HttpError(401, 'Invalid session rotation');
    }
    session.refresh_token_hash = nextRefreshTokenHash;
    session.expires_at = nextExpiresAt;
    session.rotated_at = new Date().toISOString();
    session.updated_at = new Date().toISOString();
    memorySessions.set(session.id, session);
    return session;
  }

  if (error || !data) {
    throw new HttpError(401, 'Invalid session rotation');
  }

  return data;
};

const revokeSessionById = async (sessionId) => {
  if (useMemorySessionStore) {
    const session = memorySessions.get(sessionId);
    if (session) {
      session.is_revoked = true;
      session.revoked_at = new Date().toISOString();
      session.updated_at = new Date().toISOString();
      memorySessions.set(session.id, session);
    }
    return;
  }

  const { error } = await sessionsTable()
    .update({ is_revoked: true, revoked_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (isMissingAuthSessionsTableError(error)) {
    enableMemorySessionStore();
    const session = memorySessions.get(sessionId);
    if (session) {
      session.is_revoked = true;
      session.revoked_at = new Date().toISOString();
      session.updated_at = new Date().toISOString();
      memorySessions.set(session.id, session);
    }
    return;
  }

  if (error) {
    throw new HttpError(500, 'Unable to revoke session');
  }
};

const revokeAllSessionsForUser = async (userId) => {
  if (useMemorySessionStore) {
    for (const session of listMemorySessions()) {
      if (session.user_id === userId && session.is_revoked === false) {
        session.is_revoked = true;
        session.revoked_at = new Date().toISOString();
        session.updated_at = new Date().toISOString();
        memorySessions.set(session.id, session);
      }
    }
    return;
  }

  const { error } = await sessionsTable()
    .update({ is_revoked: true, revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_revoked', false);

  if (isMissingAuthSessionsTableError(error)) {
    enableMemorySessionStore();
    for (const session of listMemorySessions()) {
      if (session.user_id === userId && session.is_revoked === false) {
        session.is_revoked = true;
        session.revoked_at = new Date().toISOString();
        session.updated_at = new Date().toISOString();
        memorySessions.set(session.id, session);
      }
    }
    return;
  }

  if (error) {
    throw new HttpError(500, 'Unable to revoke user sessions');
  }
};

module.exports = {
  createSession,
  findActiveSessionByTokenHash,
  revokeAllSessionsForUser,
  revokeSessionById,
  rotateSessionToken,
};
