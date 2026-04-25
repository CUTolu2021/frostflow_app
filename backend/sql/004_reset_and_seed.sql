-- WARNING: This resets all application data in frostflow_data
-- Use only when you want a clean start.

begin;

truncate table if exists
  frostflow_data.audit_logs,
  frostflow_data.notifications,
  frostflow_data.ai_stock_reports,
  frostflow_data.reconciliation,
  frostflow_data.sales,
  frostflow_data.stock_in_staff,
  frostflow_data.stock_in,
  frostflow_data.expenses,
  frostflow_data.products,
  frostflow_data.auth_sessions,
  frostflow_data.users,
  frostflow_data.organizations
restart identity cascade;

-- Seed superadmin placeholder (set password hash afterwards)
insert into frostflow_data.users (id, name, email, role, is_active, organization_id, must_reset_password)
values (gen_random_uuid(), 'Super Admin', 'superadmin@frostflow.app', 'superadmin', true, null, false);

commit;
