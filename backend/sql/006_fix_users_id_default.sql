-- Ensure users.id has a UUID default
create extension if not exists pgcrypto;

alter table if exists frostflow_data.users
alter column id set default gen_random_uuid();
