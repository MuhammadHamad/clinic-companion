create or replace function public.current_user_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select ur.clinic_id
  from public.user_roles ur
  where ur.user_id = auth.uid()
  order by ur.created_at desc
  limit 1
$$;

do $$
begin
  if to_regclass('public.patients') is not null then
    alter table public.patients enable row level security;
    drop policy if exists patients_tenant_isolation on public.patients;
    create policy patients_tenant_isolation
      on public.patients
      for all
      to authenticated
      using (
        public.is_super_admin()
        or public.patients.clinic_id = public.current_user_clinic_id()
      )
      with check (
        public.is_super_admin()
        or public.patients.clinic_id = public.current_user_clinic_id()
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.appointments') is not null then
    alter table public.appointments enable row level security;
    drop policy if exists appointments_tenant_isolation on public.appointments;
    create policy appointments_tenant_isolation
      on public.appointments
      for all
      to authenticated
      using (
        public.is_super_admin()
        or public.appointments.clinic_id = public.current_user_clinic_id()
      )
      with check (
        public.is_super_admin()
        or public.appointments.clinic_id = public.current_user_clinic_id()
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.invoices') is not null then
    alter table public.invoices enable row level security;
    drop policy if exists invoices_tenant_isolation on public.invoices;
    create policy invoices_tenant_isolation
      on public.invoices
      for all
      to authenticated
      using (
        public.is_super_admin()
        or public.invoices.clinic_id = public.current_user_clinic_id()
      )
      with check (
        public.is_super_admin()
        or public.invoices.clinic_id = public.current_user_clinic_id()
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.invoice_items') is not null then
    alter table public.invoice_items enable row level security;
    drop policy if exists invoice_items_tenant_isolation on public.invoice_items;
    create policy invoice_items_tenant_isolation
      on public.invoice_items
      for all
      to authenticated
      using (
        public.is_super_admin()
        or public.invoice_items.clinic_id = public.current_user_clinic_id()
      )
      with check (
        public.is_super_admin()
        or public.invoice_items.clinic_id = public.current_user_clinic_id()
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.payments') is not null then
    alter table public.payments enable row level security;
    drop policy if exists payments_tenant_isolation on public.payments;
    create policy payments_tenant_isolation
      on public.payments
      for all
      to authenticated
      using (
        public.is_super_admin()
        or public.payments.clinic_id = public.current_user_clinic_id()
      )
      with check (
        public.is_super_admin()
        or public.payments.clinic_id = public.current_user_clinic_id()
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.inventory_items') is not null then
    alter table public.inventory_items enable row level security;
    drop policy if exists inventory_items_tenant_isolation on public.inventory_items;
    create policy inventory_items_tenant_isolation
      on public.inventory_items
      for all
      to authenticated
      using (
        public.is_super_admin()
        or public.inventory_items.clinic_id = public.current_user_clinic_id()
      )
      with check (
        public.is_super_admin()
        or public.inventory_items.clinic_id = public.current_user_clinic_id()
      );
  end if;
end $$;
