-- Inventory mode per organization:
-- - dual_control: owner/staff reconciliation flow enabled
-- - single_operator: stock is applied directly from one operator entry flow
-- Safe to run multiple times.

alter table if exists frostflow_data.organizations
    add column if not exists inventory_mode text not null default 'dual_control';

update frostflow_data.organizations
set inventory_mode = 'dual_control'
where inventory_mode is null
   or inventory_mode not in ('dual_control', 'single_operator');

DO $$
BEGIN
  IF to_regclass('frostflow_data.organizations') IS NOT NULL
     AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conname = 'organizations_inventory_mode_ck'
        AND c.connamespace = 'frostflow_data'::regnamespace
    ) THEN
    ALTER TABLE frostflow_data.organizations
    ADD CONSTRAINT organizations_inventory_mode_ck
    CHECK (inventory_mode IN ('dual_control', 'single_operator'));
  END IF;
END $$;

