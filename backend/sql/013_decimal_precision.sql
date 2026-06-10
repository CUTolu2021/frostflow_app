-- Normalize key stock and money columns to NUMERIC so decimal quantities
-- and prices remain exact in the database.

begin;

alter table if exists frostflow_data.products
  alter column unit type numeric(14,3) using round(coalesce(unit, 0)::numeric, 3),
  alter column unit_price type numeric(14,2) using round(coalesce(unit_price, 0)::numeric, 2),
  alter column box_price type numeric(14,2) using case when box_price is null then null else round(box_price::numeric, 2) end,
  alter column standard_box_weight type numeric(14,3) using case when standard_box_weight is null then null else round(standard_box_weight::numeric, 3) end,
  alter column total_kilogram type numeric(14,3) using case when total_kilogram is null then null else round(total_kilogram::numeric, 3) end;

alter table if exists frostflow_data.stock_in
  alter column quantity type numeric(14,3) using round(coalesce(quantity, 0)::numeric, 3),
  alter column unit_cost type numeric(14,2) using round(coalesce(unit_cost, 0)::numeric, 2),
  alter column total_cost type numeric(14,2) using round(coalesce(total_cost, 0)::numeric, 2),
  alter column unit_price type numeric(14,2) using case when unit_price is null then null else round(unit_price::numeric, 2) end,
  alter column total_weight type numeric(14,3) using case when total_weight is null then null else round(total_weight::numeric, 3) end,
  alter column logistics_fee type numeric(14,2) using case when logistics_fee is null then null else round(logistics_fee::numeric, 2) end,
  alter column box_price type numeric(14,2) using case when box_price is null then null else round(box_price::numeric, 2) end;

alter table if exists frostflow_data.stock_in_staff
  alter column quantity type numeric(14,3) using round(coalesce(quantity, 0)::numeric, 3);

alter table if exists frostflow_data.sales
  alter column quantity type numeric(14,3) using round(coalesce(quantity, 0)::numeric, 3),
  alter column selling_price type numeric(14,2) using round(coalesce(selling_price, 0)::numeric, 2),
  alter column total_price type numeric(14,2) using round(coalesce(total_price, 0)::numeric, 2),
  alter column box_weight type numeric(14,3) using case when box_weight is null then null else round(box_weight::numeric, 3) end;

alter table if exists frostflow_data.expenses
  alter column amount type numeric(14,2) using round(coalesce(amount, 0)::numeric, 2);

alter table if exists frostflow_data.reconciliation
  alter column owner_quantity type numeric(14,3) using round(coalesce(owner_quantity, 0)::numeric, 3),
  alter column staff_quantity type numeric(14,3) using round(coalesce(staff_quantity, 0)::numeric, 3),
  alter column difference type numeric(14,3) using round(coalesce(difference, 0)::numeric, 3);

alter table if exists frostflow_data.delivery_sessions
  alter column inventory_applied_quantity type numeric(14,3) using round(coalesce(inventory_applied_quantity, 0)::numeric, 3);

commit;
