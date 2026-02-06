create or replace function public.is_clinic_admin(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
      and ur.clinic_id = p_clinic_id
  );
$$;

revoke all on function public.is_clinic_admin(uuid) from public;
grant execute on function public.is_clinic_admin(uuid) to authenticated;

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  is_system boolean not null default false
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'expense_categories_clinic_id_name_unique'
  ) then
    alter table public.expense_categories
      add constraint expense_categories_clinic_id_name_unique unique (clinic_id, name);
  end if;
end $$;

create index if not exists expense_categories_clinic_id_created_at_idx
  on public.expense_categories (clinic_id, created_at desc);

alter table public.expense_categories enable row level security;

drop policy if exists expense_categories_admin_only on public.expense_categories;
create policy expense_categories_admin_only
  on public.expense_categories
  for all
  to authenticated
  using (
    public.is_super_admin()
    or public.is_clinic_admin(public.expense_categories.clinic_id)
  )
  with check (
    public.is_super_admin()
    or public.is_clinic_admin(public.expense_categories.clinic_id)
  );

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  expense_date date not null,
  amount numeric not null check (amount >= 0),
  category_id uuid references public.expense_categories(id) on delete set null,
  vendor_name text,
  payment_method text check (payment_method in ('cash','card','bank_transfer','cheque') or payment_method is null),
  description text not null,
  notes text
);

create index if not exists expenses_clinic_id_expense_date_idx
  on public.expenses (clinic_id, expense_date desc);

create index if not exists expenses_clinic_id_category_id_idx
  on public.expenses (clinic_id, category_id);

alter table public.expenses enable row level security;

drop policy if exists expenses_admin_only on public.expenses;
create policy expenses_admin_only
  on public.expenses
  for all
  to authenticated
  using (
    public.is_super_admin()
    or public.is_clinic_admin(public.expenses.clinic_id)
  )
  with check (
    public.is_super_admin()
    or public.is_clinic_admin(public.expenses.clinic_id)
  );

insert into public.expense_categories (clinic_id, name, is_system)
select c.id, v.name, true
from public.clinics c
cross join (values
  ('Salaries'),
  ('Rent'),
  ('Electricity'),
  ('Internet'),
  ('Supplies'),
  ('Maintenance'),
  ('Marketing'),
  ('Misc')
) as v(name)
on conflict (clinic_id, name) do nothing;
