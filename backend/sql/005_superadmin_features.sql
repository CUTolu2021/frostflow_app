-- Superadmin features: must_reset_password + organization status

alter table if exists frostflow_data.users
add column if not exists must_reset_password boolean not null default false;

alter table if exists frostflow_data.organizations
add column if not exists is_active boolean not null default true;

create index if not exists organizations_active_idx on frostflow_data.organizations (is_active);
create index if not exists users_reset_password_idx on frostflow_data.users (must_reset_password);
