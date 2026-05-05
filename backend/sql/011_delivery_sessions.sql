-- Delivery session model for reconciliation:
-- - Owner can create stock entries ahead of actual arrival.
-- - Staff receives against an open delivery session.
-- - Reconciliation compares by delivery_session_id + product_id.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists frostflow_data.delivery_sessions (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references frostflow_data.organizations(id) on delete cascade,
    product_id uuid not null references frostflow_data.products(id) on delete cascade,
    created_by uuid references frostflow_data.users(id) on delete set null,
    source text not null default 'owner_entry',
    status text not null default 'in_transit',
    expected_arrival_at timestamptz not null default now(),
    grace_until timestamptz not null default (now() + interval '24 hours'),
    escalated_at timestamptz,
    closed_at timestamptz,
    inventory_applied_quantity double precision not null default 0,
    inventory_applied_at timestamptz,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table if exists frostflow_data.delivery_sessions
    add column if not exists inventory_applied_quantity double precision not null default 0,
    add column if not exists inventory_applied_at timestamptz;

DO $$
BEGIN
  IF to_regclass('frostflow_data.delivery_sessions') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'delivery_sessions_status_ck'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.delivery_sessions
    ADD CONSTRAINT delivery_sessions_status_ck
    CHECK (status in ('in_transit', 'partially_received', 'received', 'exception', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.delivery_sessions') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'delivery_sessions_applied_qty_ck'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.delivery_sessions
    ADD CONSTRAINT delivery_sessions_applied_qty_ck
    CHECK (inventory_applied_quantity >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.delivery_sessions') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'delivery_sessions_source_ck'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.delivery_sessions
    ADD CONSTRAINT delivery_sessions_source_ck
    CHECK (source in ('owner_entry', 'staff_entry', 'manual'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.delivery_sessions') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'delivery_sessions_grace_window_ck'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.delivery_sessions
    ADD CONSTRAINT delivery_sessions_grace_window_ck
    CHECK (grace_until >= expected_arrival_at);
  END IF;
END $$;

alter table if exists frostflow_data.stock_in
    add column if not exists delivery_session_id uuid;

alter table if exists frostflow_data.stock_in_staff
    add column if not exists delivery_session_id uuid;

alter table if exists frostflow_data.reconciliation
    add column if not exists delivery_session_id uuid;

DO $$
BEGIN
  IF to_regclass('frostflow_data.stock_in') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'stock_in_delivery_session_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.stock_in
    ADD CONSTRAINT stock_in_delivery_session_fk
    FOREIGN KEY (delivery_session_id)
    REFERENCES frostflow_data.delivery_sessions(id)
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.stock_in_staff') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'stock_in_staff_delivery_session_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.stock_in_staff
    ADD CONSTRAINT stock_in_staff_delivery_session_fk
    FOREIGN KEY (delivery_session_id)
    REFERENCES frostflow_data.delivery_sessions(id)
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('frostflow_data.reconciliation') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'reconciliation_delivery_session_fk'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.reconciliation
    ADD CONSTRAINT reconciliation_delivery_session_fk
    FOREIGN KEY (delivery_session_id)
    REFERENCES frostflow_data.delivery_sessions(id)
    ON DELETE SET NULL;
  END IF;
END $$;

create index if not exists delivery_sessions_org_product_status_idx
on frostflow_data.delivery_sessions (organization_id, product_id, status);

create index if not exists delivery_sessions_org_eta_idx
on frostflow_data.delivery_sessions (organization_id, expected_arrival_at);

create index if not exists delivery_sessions_org_grace_idx
on frostflow_data.delivery_sessions (organization_id, grace_until, status);

create index if not exists stock_in_delivery_session_idx
on frostflow_data.stock_in (organization_id, delivery_session_id, product_id);

create index if not exists stock_in_staff_delivery_session_idx
on frostflow_data.stock_in_staff (organization_id, delivery_session_id, product_id);

create index if not exists reconciliation_delivery_session_idx
on frostflow_data.reconciliation (organization_id, delivery_session_id);

alter table if exists frostflow_data.delivery_sessions enable row level security;

drop policy if exists delivery_sessions_select on frostflow_data.delivery_sessions;
drop policy if exists delivery_sessions_insert on frostflow_data.delivery_sessions;
drop policy if exists delivery_sessions_update on frostflow_data.delivery_sessions;

DO $$
BEGIN
  IF to_regprocedure('frostflow_data.can_access_org(uuid)') IS NOT NULL THEN
    EXECUTE $policy$
      create policy delivery_sessions_select
      on frostflow_data.delivery_sessions
      for select
      using (frostflow_data.can_access_org(organization_id))
    $policy$;

    EXECUTE $policy$
      create policy delivery_sessions_insert
      on frostflow_data.delivery_sessions
      for insert
      with check (frostflow_data.can_access_org(organization_id))
    $policy$;

    EXECUTE $policy$
      create policy delivery_sessions_update
      on frostflow_data.delivery_sessions
      for update
      using (frostflow_data.can_access_org(organization_id))
      with check (frostflow_data.can_access_org(organization_id))
    $policy$;
  ELSIF to_regprocedure('frostflow_data.app_role()') IS NOT NULL
     AND to_regprocedure('frostflow_data.current_org_id()') IS NOT NULL THEN
    EXECUTE $policy$
      create policy delivery_sessions_select
      on frostflow_data.delivery_sessions
      for select
      using (frostflow_data.app_role() = 'superadmin' or organization_id = frostflow_data.current_org_id())
    $policy$;

    EXECUTE $policy$
      create policy delivery_sessions_insert
      on frostflow_data.delivery_sessions
      for insert
      with check (frostflow_data.app_role() = 'superadmin' or organization_id = frostflow_data.current_org_id())
    $policy$;

    EXECUTE $policy$
      create policy delivery_sessions_update
      on frostflow_data.delivery_sessions
      for update
      using (frostflow_data.app_role() = 'superadmin' or organization_id = frostflow_data.current_org_id())
      with check (frostflow_data.app_role() = 'superadmin' or organization_id = frostflow_data.current_org_id())
    $policy$;
  ELSIF to_regprocedure('frostflow_data.jwt_role()') IS NOT NULL
     AND to_regprocedure('frostflow_data.jwt_org_id()') IS NOT NULL THEN
    EXECUTE $policy$
      create policy delivery_sessions_select
      on frostflow_data.delivery_sessions
      for select
      using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
    $policy$;

    EXECUTE $policy$
      create policy delivery_sessions_insert
      on frostflow_data.delivery_sessions
      for insert
      with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
    $policy$;

    EXECUTE $policy$
      create policy delivery_sessions_update
      on frostflow_data.delivery_sessions
      for update
      using (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
      with check (frostflow_data.jwt_role() = 'superadmin' or organization_id = frostflow_data.jwt_org_id())
    $policy$;
  ELSE
    RAISE EXCEPTION
      'Missing org access helper function. Expected one of: frostflow_data.can_access_org(uuid), (frostflow_data.app_role + frostflow_data.current_org_id), or (frostflow_data.jwt_role + frostflow_data.jwt_org_id).';
  END IF;
END $$;
