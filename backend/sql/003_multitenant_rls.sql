-- Multi-tenant + RLS hardening for Frostflow
-- Apply after 001_auth_password_hash.sql and 002_auth_sessions.sql

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- Add organization_id to tenant tables
alter table if exists frostflow_data.users
add column if not exists organization_id uuid;

alter table if exists frostflow_data.products
add column if not exists organization_id uuid;

alter table if exists frostflow_data.stock_in
add column if not exists organization_id uuid;

alter table if exists frostflow_data.stock_in_staff
add column if not exists organization_id uuid;

alter table if exists frostflow_data.sales
add column if not exists organization_id uuid;

alter table if exists frostflow_data.expenses
add column if not exists organization_id uuid;

alter table if exists frostflow_data.reconciliation
add column if not exists organization_id uuid;

alter table if exists frostflow_data.audit_logs
add column if not exists organization_id uuid;

alter table if exists frostflow_data.notifications
add column if not exists organization_id uuid;

alter table if exists frostflow_data.ai_stock_reports
add column if not exists organization_id uuid;

-- Remove legacy permissive policy (if present)
drop policy if exists "Enable read access for all users" on frostflow_data.products;

-- Foreign keys (safe if already present)
DO $$
BEGIN
  IF to_regclass('frostflow_data.users') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'users_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.users
    ADD CONSTRAINT users_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.products') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'products_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.products
    ADD CONSTRAINT products_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.stock_in') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'stock_in_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.stock_in
    ADD CONSTRAINT stock_in_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.stock_in_staff') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'stock_in_staff_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.stock_in_staff
    ADD CONSTRAINT stock_in_staff_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.sales') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'sales_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.sales
    ADD CONSTRAINT sales_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.expenses') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'expenses_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.expenses
    ADD CONSTRAINT expenses_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.reconciliation') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'reconciliation_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.reconciliation
    ADD CONSTRAINT reconciliation_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.audit_logs') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'audit_logs_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.audit_logs
    ADD CONSTRAINT audit_logs_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.notifications') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'notifications_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.notifications
    ADD CONSTRAINT notifications_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.ai_stock_reports') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'ai_stock_reports_organization_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.ai_stock_reports
    ADD CONSTRAINT ai_stock_reports_organization_fk
    FOREIGN KEY (organization_id) REFERENCES frostflow_data.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes
create index if not exists users_organization_idx on frostflow_data.users (organization_id);
create index if not exists products_organization_idx on frostflow_data.products (organization_id);
create index if not exists stock_in_organization_idx on frostflow_data.stock_in (organization_id);
create index if not exists stock_in_staff_organization_idx on frostflow_data.stock_in_staff (organization_id);
create index if not exists sales_organization_idx on frostflow_data.sales (organization_id);
create index if not exists expenses_organization_idx on frostflow_data.expenses (organization_id);
create index if not exists reconciliation_organization_idx on frostflow_data.reconciliation (organization_id);
create index if not exists audit_logs_organization_idx on frostflow_data.audit_logs (organization_id);
create index if not exists notifications_organization_idx on frostflow_data.notifications (organization_id);
create index if not exists ai_stock_reports_organization_idx on frostflow_data.ai_stock_reports (organization_id);

-- Ensure non-superadmin users have org context
DO $$
BEGIN
  IF to_regclass('frostflow_data.users') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'users_org_required_ck'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.users
    ADD CONSTRAINT users_org_required_ck
    CHECK (role = 'superadmin' OR organization_id IS NOT NULL);
  END IF;
END $$;

-- Helper functions for RLS
create or replace function frostflow_data.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', '');
$$;

create or replace function frostflow_data.jwt_org_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'organization_id', '')::uuid;
$$;

-- Enable RLS on tenant tables
alter table if exists frostflow_data.organizations enable row level security;
alter table if exists frostflow_data.users enable row level security;
alter table if exists frostflow_data.products enable row level security;
alter table if exists frostflow_data.stock_in enable row level security;
alter table if exists frostflow_data.stock_in_staff enable row level security;
alter table if exists frostflow_data.sales enable row level security;
alter table if exists frostflow_data.expenses enable row level security;
alter table if exists frostflow_data.reconciliation enable row level security;
alter table if exists frostflow_data.audit_logs enable row level security;
alter table if exists frostflow_data.notifications enable row level security;
alter table if exists frostflow_data.ai_stock_reports enable row level security;

-- Organizations
create policy if not exists organizations_select
on frostflow_data.organizations
for select
using (
  frostflow_data.jwt_role() = 'superadmin'
  or id = frostflow_data.jwt_org_id()
);

create policy if not exists organizations_insert
on frostflow_data.organizations
for insert
with check (frostflow_data.jwt_role() = 'superadmin');

create policy if not exists organizations_update
on frostflow_data.organizations
for update
using (frostflow_data.jwt_role() = 'superadmin')
with check (frostflow_data.jwt_role() = 'superadmin');

-- Users
create policy if not exists users_select
on frostflow_data.users
for select
using (
  frostflow_data.jwt_role() = 'superadmin'
  or organization_id = frostflow_data.jwt_org_id()
);

create policy if not exists users_insert
on frostflow_data.users
for insert
with check (
  frostflow_data.jwt_role() = 'superadmin'
  or organization_id = frostflow_data.jwt_org_id()
);

create policy if not exists users_update
on frostflow_data.users
for update
using (
  frostflow_data.jwt_role() = 'superadmin'
  or organization_id = frostflow_data.jwt_org_id()
)
with check (
  frostflow_data.jwt_role() = 'superadmin'
  or organization_id = frostflow_data.jwt_org_id()
);

-- Generic org-scoped policies for tenant tables
-- Products
create policy if not exists products_select
on frostflow_data.products
for select
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists products_insert
on frostflow_data.products
for insert
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists products_update
on frostflow_data.products
for update
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

-- Stock In
create policy if not exists stock_in_select
on frostflow_data.stock_in
for select
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists stock_in_insert
on frostflow_data.stock_in
for insert
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists stock_in_update
on frostflow_data.stock_in
for update
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

-- Stock In Staff
create policy if not exists stock_in_staff_select
on frostflow_data.stock_in_staff
for select
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists stock_in_staff_insert
on frostflow_data.stock_in_staff
for insert
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists stock_in_staff_update
on frostflow_data.stock_in_staff
for update
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

-- Sales
create policy if not exists sales_select
on frostflow_data.sales
for select
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists sales_insert
on frostflow_data.sales
for insert
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists sales_update
on frostflow_data.sales
for update
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

-- Expenses
create policy if not exists expenses_select
on frostflow_data.expenses
for select
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists expenses_insert
on frostflow_data.expenses
for insert
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists expenses_update
on frostflow_data.expenses
for update
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

-- Reconciliation
create policy if not exists reconciliation_select
on frostflow_data.reconciliation
for select
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists reconciliation_insert
on frostflow_data.reconciliation
for insert
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists reconciliation_update
on frostflow_data.reconciliation
for update
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

-- Audit Logs
create policy if not exists audit_logs_select
on frostflow_data.audit_logs
for select
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists audit_logs_insert
on frostflow_data.audit_logs
for insert
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

-- Notifications
create policy if not exists notifications_select
on frostflow_data.notifications
for select
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists notifications_insert
on frostflow_data.notifications
for insert
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists notifications_update
on frostflow_data.notifications
for update
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

-- AI Stock Reports
create policy if not exists ai_reports_select
on frostflow_data.ai_stock_reports
for select
using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

create policy if not exists ai_reports_insert
on frostflow_data.ai_stock_reports
for insert
with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id());

