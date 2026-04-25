-- Reconciliation engine columns for product_id + daily window + cutoff escalation
-- Safe to run multiple times.

alter table if exists frostflow_data.reconciliation
    add column if not exists window_date date,
    add column if not exists is_escalated boolean not null default false,
    add column if not exists escalated_at timestamptz;

update frostflow_data.reconciliation
set window_date = coalesce(window_date, created_at::date, now()::date)
where window_date is null;

alter table if exists frostflow_data.reconciliation
    alter column window_date set default now()::date;

create index if not exists reconciliation_window_lookup_idx
on frostflow_data.reconciliation (organization_id, product_id, window_date);

create index if not exists reconciliation_escalation_idx
on frostflow_data.reconciliation (organization_id, window_date, is_escalated, status);
