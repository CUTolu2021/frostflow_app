-- Support manual business expenses that should appear in analytics.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

alter table if exists frostflow_data.expenses
  add column if not exists expense_date date,
  add column if not exists notes text,
  add column if not exists organization_id uuid,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz default now();

update frostflow_data.expenses
set expense_date = coalesce(expense_date, created_at::date, current_date)
where expense_date is null;

alter table if exists frostflow_data.expenses
  alter column expense_date set default current_date;

DO $$
BEGIN
  IF to_regclass('frostflow_data.expenses') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'expenses_created_by_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.expenses
    ADD CONSTRAINT expenses_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES frostflow_data.users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.expenses') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'expenses_amount_positive_ck'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.expenses
    ADD CONSTRAINT expenses_amount_positive_ck
    CHECK (amount > 0);
  END IF;
END $$;

create index if not exists expenses_org_date_idx
on frostflow_data.expenses (organization_id, expense_date desc);

create index if not exists expenses_created_by_idx
on frostflow_data.expenses (created_by);
