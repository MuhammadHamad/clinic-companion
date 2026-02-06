-- Add is_bill flag to expense categories so monthly ledger cards are driven by category type

alter table public.expense_categories
  add column if not exists is_bill boolean not null default false;

create index if not exists expense_categories_clinic_id_is_bill_idx
  on public.expense_categories (clinic_id, is_bill, name);

-- Backfill defaults: treat common utilities as bills
update public.expense_categories
set is_bill = true
where name in ('Rent', 'Electricity', 'Internet');
