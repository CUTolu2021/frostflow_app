-- Harden staff_invites shape for invite rotation and preview flows.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists frostflow_data.staff_invites (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references frostflow_data.organizations(id) on delete cascade,
    invited_email text not null,
    role text not null,
    invite_token_hash text not null unique,
    expires_at timestamptz not null,
    created_by uuid not null references frostflow_data.users(id) on delete cascade,
    used_by uuid references frostflow_data.users(id) on delete set null,
    used_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists frostflow_data.staff_invites
    add column if not exists organization_id uuid references frostflow_data.organizations(id) on delete cascade,
    add column if not exists invited_email text,
    add column if not exists role text,
    add column if not exists invite_token_hash text,
    add column if not exists expires_at timestamptz,
    add column if not exists created_by uuid references frostflow_data.users(id) on delete cascade,
    add column if not exists used_by uuid references frostflow_data.users(id) on delete set null,
    add column if not exists used_at timestamptz,
    add column if not exists revoked_at timestamptz,
    add column if not exists created_at timestamptz default now(),
    add column if not exists updated_at timestamptz default now();

create unique index if not exists staff_invites_token_hash_uidx
on frostflow_data.staff_invites (invite_token_hash);

create index if not exists staff_invites_org_email_idx
on frostflow_data.staff_invites (organization_id, lower(invited_email));

create index if not exists staff_invites_active_idx
on frostflow_data.staff_invites (invite_token_hash, expires_at, used_at, revoked_at);

alter table if exists frostflow_data.staff_invites enable row level security;
