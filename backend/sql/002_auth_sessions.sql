-- Persisted refresh-token sessions for rotation and revocation.
-- Run this against your Supabase Postgres database.

create extension if not exists pgcrypto;

create table if not exists frostflow_data.auth_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references frostflow_data.users(id) on delete cascade,
    refresh_token_hash text not null unique,
    expires_at timestamptz not null,
    is_revoked boolean not null default false,
    revoked_at timestamptz,
    rotated_at timestamptz,
    user_agent text,
    ip_address text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists auth_sessions_user_active_idx
on frostflow_data.auth_sessions (user_id, is_revoked, expires_at);
