-- Expand recurring_expenses.payment_method allowed values to match expenses

alter table public.recurring_expenses
  drop constraint if exists recurring_expenses_payment_method_check;

alter table public.recurring_expenses
  add constraint recurring_expenses_payment_method_check
  check (
    payment_method in (
      'cash',
      'bank_transfer',
      'card'
    )
    or payment_method is null
  );
