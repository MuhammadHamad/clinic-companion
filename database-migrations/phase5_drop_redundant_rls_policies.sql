do $$
begin
  if to_regclass('public.patients') is not null then
    drop policy if exists patients_by_clinic_or_super_admin on public.patients;
  end if;
end $$;

do $$
begin
  if to_regclass('public.appointments') is not null then
    drop policy if exists appointments_by_clinic_or_super_admin on public.appointments;
  end if;
end $$;

do $$
begin
  if to_regclass('public.invoices') is not null then
    drop policy if exists invoices_by_clinic on public.invoices;
    drop policy if exists invoices_super_admin_all on public.invoices;
  end if;
end $$;

do $$
begin
  if to_regclass('public.invoice_items') is not null then
    drop policy if exists invoice_items_by_invoice_clinic on public.invoice_items;
    drop policy if exists invoice_items_super_admin_all on public.invoice_items;
  end if;
end $$;

do $$
begin
  if to_regclass('public.payments') is not null then
    drop policy if exists payments_by_clinic_or_super_admin on public.payments;
  end if;
end $$;

do $$
begin
  if to_regclass('public.inventory_items') is not null then
    drop policy if exists inventory_items_by_clinic on public.inventory_items;
    drop policy if exists inventory_items_super_admin_all on public.inventory_items;
  end if;
end $$;
