-- Soft delete support for organizations
alter table if exists frostflow_data.organizations
add column if not exists deleted_at timestamptz;

create index if not exists organizations_deleted_at_idx on frostflow_data.organizations (deleted_at);
