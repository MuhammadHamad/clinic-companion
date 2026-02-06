create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  next_due_date date not null,
  amount numeric not null check (amount >= 0),
  category_id uuid references public.expense_categories(id) on delete set null,
  vendor_name text,
  payment_method text check (payment_method in ('cash','card','bank_transfer','cheque') or payment_method is null),
  description text not null,
  notes text,
  is_active boolean not null default true
);

create index if not exists recurring_expenses_clinic_id_next_due_date_idx
  on public.recurring_expenses (clinic_id, next_due_date asc);

alter table public.recurring_expenses enable row level security;

drop policy if exists recurring_expenses_admin_only on public.recurring_expenses;
create policy recurring_expenses_admin_only
  on public.recurring_expenses
  for all
  to authenticated
  using (
    public.is_super_admin()
    or public.is_clinic_admin(public.recurring_expenses.clinic_id)
  )
  with check (
    public.is_super_admin()
    or public.is_clinic_admin(public.recurring_expenses.clinic_id)
  );

alter table public.expenses
  add column if not exists recurring_expense_id uuid references public.recurring_expenses(id) on delete set null;

create index if not exists expenses_recurring_expense_id_idx
  on public.expenses (recurring_expense_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expenses_recurring_expense_id_expense_date_unique'
  ) then
    alter table public.expenses
      add constraint expenses_recurring_expense_id_expense_date_unique unique (recurring_expense_id, expense_date);
  end if;
end $$;

create or replace function public.generate_due_recurring_expenses(p_clinic_id uuid, p_as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_inserted_total integer := 0;
  v_inserted integer := 0;
  v_last_due date;
  r public.recurring_expenses%rowtype;
begin
  if p_clinic_id is null then
    raise exception 'clinic_id is required';
  end if;

  if not (public.is_super_admin() or public.is_clinic_admin(p_clinic_id)) then
    raise exception 'not authorized';
  end if;

  for r in
    select *
    from public.recurring_expenses
    where clinic_id = p_clinic_id
      and is_active = true
      and next_due_date <= p_as_of
    order by next_due_date asc
    for update
  loop
    with due_dates as (
      select (gs)::date as due_date
      from generate_series(
        r.next_due_date::timestamptz,
        p_as_of::timestamptz,
        interval '1 month'
      ) gs
    ), ins as (
      insert into public.expenses (
        clinic_id,
        expense_date,
        amount,
        category_id,
        vendor_name,
        payment_method,
        description,
        notes,
        recurring_expense_id
      )
      select
        r.clinic_id,
        d.due_date,
        r.amount,
        r.category_id,
        r.vendor_name,
        r.payment_method,
        r.description,
        r.notes,
        r.id
      from due_dates d
      on conflict (recurring_expense_id, expense_date) do nothing
      returning 1
    )
    select count(*) into v_inserted from ins;

    v_inserted_total := v_inserted_total + v_inserted;

    select max(due_date) into v_last_due from due_dates;

    update public.recurring_expenses
      set next_due_date = (v_last_due + interval '1 month')::date,
          updated_at = now()
      where id = r.id;
  end loop;

  return v_inserted_total;
end;
$$;

revoke all on function public.generate_due_recurring_expenses(uuid, date) from public;
grant execute on function public.generate_due_recurring_expenses(uuid, date) to authenticated;
