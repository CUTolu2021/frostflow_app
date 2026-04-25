-- Add password hash support for JWT-based auth (no Supabase Auth dependency).
-- Run this against your Supabase Postgres database.

alter table if exists frostflow_data.users
add column if not exists password_hash text;

-- Optional hardening (run only after backfilling all users):
-- alter table frostflow_data.users alter column password_hash set not null;

-- Ensure email uniqueness for login integrity.
create unique index if not exists users_email_unique_idx
on frostflow_data.users (lower(email));
