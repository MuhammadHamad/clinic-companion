-- Add expense_type enum to expenses table for ad-hoc vs recurring classification

-- Create expense_type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'expense_type') then
    create type expense_type as enum ('ad_hoc', 'recurring');
  end if;
end $$;

-- Add expense_type column to expenses table
alter table public.expenses
  add column if not exists expense_type expense_type not null default 'ad_hoc';

-- Add index for filtering by expense type
create index if not exists expenses_clinic_id_expense_type_idx
  on public.expenses (clinic_id, expense_type, expense_date desc);

-- Backfill existing expenses based on is_recurring flag (if it exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'expenses' 
    and column_name = 'is_recurring'
  ) then
    update public.expenses
    set expense_type = case when is_recurring = true then 'recurring'::expense_type else 'ad_hoc'::expense_type end
    where expense_type = 'ad_hoc';
  end if;
end $$;

comment on column public.expenses.expense_type is 'Type of expense: ad_hoc (miscellaneous/daily) or recurring (monthly bills)';
