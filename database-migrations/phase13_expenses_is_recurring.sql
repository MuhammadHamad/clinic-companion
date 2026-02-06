-- Add is_recurring flag to expenses table to distinguish recurring bills from ad-hoc expenses

alter table public.expenses
  add column if not exists is_recurring boolean not null default false;

-- Add index for filtering recurring expenses
create index if not exists expenses_clinic_id_is_recurring_idx
  on public.expenses (clinic_id, is_recurring, expense_date desc);

-- Update payment_method enum to include more modern options
alter table public.expenses
  drop constraint if exists expenses_payment_method_check;

alter table public.expenses
  add constraint expenses_payment_method_check
  check (payment_method in ('cash','bank_transfer','card','credit_card','debit_card','mobile_wallet','cheque') or payment_method is null);

comment on column public.expenses.is_recurring is 'Indicates if this is a recurring bill (rent, utilities) vs ad-hoc expense (miscellaneous, daily items)';
