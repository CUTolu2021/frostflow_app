create extension if not exists pgcrypto;

alter table if exists frostflow_data.sales
  add column if not exists invoice_id text;

update frostflow_data.sales
set invoice_id = coalesce(invoice_id, 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)))
where invoice_id is null or btrim(invoice_id) = '';

alter table if exists frostflow_data.sales
  alter column invoice_id set default ('INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

create index if not exists sales_invoice_id_idx
on frostflow_data.sales (organization_id, invoice_id);

create table if not exists frostflow_data.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references frostflow_data.sales(id) on delete cascade,
  organization_id uuid not null references frostflow_data.organizations(id) on delete cascade,
  method text not null,
  amount numeric(14,2) not null,
  reference_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'sale_payments_method_ck'
      AND c.connamespace = 'frostflow_data'::regnamespace
  ) THEN
    ALTER TABLE frostflow_data.sale_payments
    ADD CONSTRAINT sale_payments_method_ck
    CHECK (method in ('cash', 'card', 'transfer', 'credit'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'sale_payments_amount_ck'
      AND c.connamespace = 'frostflow_data'::regnamespace
  ) THEN
    ALTER TABLE frostflow_data.sale_payments
    ADD CONSTRAINT sale_payments_amount_ck
    CHECK (amount > 0);
  END IF;
END $$;

create index if not exists sale_payments_sale_idx
on frostflow_data.sale_payments (sale_id);

create index if not exists sale_payments_org_method_idx
on frostflow_data.sale_payments (organization_id, method, created_at desc);

alter table if exists frostflow_data.sale_payments enable row level security;

DO $$
BEGIN
  IF to_regprocedure('frostflow_data.can_access_org(uuid)') IS NOT NULL THEN
    DROP POLICY IF EXISTS sale_payments_select ON frostflow_data.sale_payments;
    CREATE POLICY sale_payments_select
      ON frostflow_data.sale_payments
      FOR SELECT
      USING (frostflow_data.can_access_org(organization_id));

    DROP POLICY IF EXISTS sale_payments_insert ON frostflow_data.sale_payments;
    CREATE POLICY sale_payments_insert
      ON frostflow_data.sale_payments
      FOR INSERT
      WITH CHECK (frostflow_data.can_access_org(organization_id));

    DROP POLICY IF EXISTS sale_payments_update ON frostflow_data.sale_payments;
    CREATE POLICY sale_payments_update
      ON frostflow_data.sale_payments
      FOR UPDATE
      USING (frostflow_data.can_access_org(organization_id))
      WITH CHECK (frostflow_data.can_access_org(organization_id));
  ELSIF to_regprocedure('frostflow_data.app_role()') IS NOT NULL
     AND to_regprocedure('frostflow_data.current_org_id()') IS NOT NULL THEN
    DROP POLICY IF EXISTS sale_payments_select ON frostflow_data.sale_payments;
    CREATE POLICY sale_payments_select
      ON frostflow_data.sale_payments
      FOR SELECT
      USING (frostflow_data.app_role() = 'superadmin' or organization_id = frostflow_data.current_org_id());

    DROP POLICY IF EXISTS sale_payments_insert ON frostflow_data.sale_payments;
    CREATE POLICY sale_payments_insert
      ON frostflow_data.sale_payments
      FOR INSERT
      WITH CHECK (frostflow_data.app_role() = 'superadmin' or organization_id = frostflow_data.current_org_id());

    DROP POLICY IF EXISTS sale_payments_update ON frostflow_data.sale_payments;
    CREATE POLICY sale_payments_update
      ON frostflow_data.sale_payments
      FOR UPDATE
      USING (frostflow_data.app_role() = 'superadmin' or organization_id = frostflow_data.current_org_id())
      WITH CHECK (frostflow_data.app_role() = 'superadmin' or organization_id = frostflow_data.current_org_id());
  END IF;
END $$;
