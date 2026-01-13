-- Safe clinic deletion RPC that handles all related data
create or replace function public.delete_clinic_cascade(target_clinic_id uuid)
returns json
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  deleted_counts json;
  patient_ids uuid[] := '{}'::uuid[];
  invoice_ids uuid[] := '{}'::uuid[];
  patients_count int := 0;
  invoices_count int := 0;
  payments_count int := 0;
  appointments_count int := 0;
  inventory_count int := 0;
  categories_count int := 0;
  visits_count int := 0;
  adjustments_count int := 0;
  treatment_types_count int := 0;
  user_roles_count int := 0;
begin
  -- Only super_admin can delete clinics
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;

  -- Check if clinic exists
  if not exists (select 1 from public.clinics where id = target_clinic_id) then
    raise exception 'clinic not found';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'patients'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patients'
      and column_name = 'clinic_id'
  ) then
    select coalesce(array_agg(p.id), '{}'::uuid[])
    into patient_ids
    from public.patients p
    where p.clinic_id = target_clinic_id;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'invoices'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'invoices'
        and column_name = 'clinic_id'
    ) then
      execute 'select coalesce(array_agg(i.id), ''{}''::uuid[]) from public.invoices i where i.clinic_id = $1'
      into invoice_ids
      using target_clinic_id;
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'invoices'
        and column_name = 'patient_id'
    ) then
      execute 'select coalesce(array_agg(i.id), ''{}''::uuid[]) from public.invoices i where i.patient_id = any($1)'
      into invoice_ids
      using patient_ids;
    end if;
  end if;

  -- Delete related data in correct order (respecting dependencies)
  -- Only delete from tables that exist
  
  -- 1. Delete invoice adjustments (depends on invoices) - if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invoice_adjustments') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'invoice_adjustments' and column_name = 'invoice_id') then
      execute 'delete from public.invoice_adjustments where invoice_id = any($1)'
      using invoice_ids;
      get diagnostics adjustments_count = row_count;
    end if;
  end if;

  -- 2. Delete payments (depends on invoices and patients) - if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'payments') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'clinic_id') then
      execute 'delete from public.payments where clinic_id = $1'
      using target_clinic_id;
      get diagnostics payments_count = row_count;
    elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'invoice_id') then
      execute 'delete from public.payments where invoice_id = any($1)'
      using invoice_ids;
      get diagnostics payments_count = row_count;
    elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'patient_id') then
      execute 'delete from public.payments where patient_id = any($1)'
      using patient_ids;
      get diagnostics payments_count = row_count;
    end if;
  end if;

  -- 3. Delete visits (depends on patients) - if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'visits') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'visits' and column_name = 'patient_id') then
      execute 'delete from public.visits where patient_id = any($1)'
      using patient_ids;
      get diagnostics visits_count = row_count;
    end if;
  end if;

  -- 4. Delete invoices (depends on patients) - if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invoices') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'invoices' and column_name = 'clinic_id') then
      execute 'delete from public.invoices where clinic_id = $1'
      using target_clinic_id;
      get diagnostics invoices_count = row_count;
    elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'invoices' and column_name = 'patient_id') then
      execute 'delete from public.invoices where patient_id = any($1)'
      using patient_ids;
      get diagnostics invoices_count = row_count;
    end if;
  end if;

  -- 5. Delete appointments (depends on patients) - if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'appointments') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = 'patient_id') then
      execute 'delete from public.appointments where patient_id = any($1)'
      using patient_ids;
      get diagnostics appointments_count = row_count;
    end if;
  end if;

  -- 6. Delete patients - if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'patients') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'patients' and column_name = 'clinic_id') then
      execute 'delete from public.patients where clinic_id = $1'
      using target_clinic_id;
      get diagnostics patients_count = row_count;
    end if;
  end if;

  -- 7. Delete inventory items - if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventory' and column_name = 'clinic_id') then
      execute 'delete from public.inventory where clinic_id = $1'
      using target_clinic_id;
      get diagnostics inventory_count = row_count;
    end if;
  end if;

  -- 8. Delete inventory categories - if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inventory_categories') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inventory_categories' and column_name = 'clinic_id') then
      execute 'delete from public.inventory_categories where clinic_id = $1'
      using target_clinic_id;
      get diagnostics categories_count = row_count;
    end if;
  end if;

  -- 9. Delete treatment types - if table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'treatment_types') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'treatment_types' and column_name = 'clinic_id') then
      execute 'delete from public.treatment_types where clinic_id = $1'
      using target_clinic_id;
      get diagnostics treatment_types_count = row_count;
    end if;
  end if;

  -- 10. Remove clinic membership in user_roles
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_roles') then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_roles' and column_name = 'clinic_id') then
      execute 'delete from public.user_roles where clinic_id = $1'
      using target_clinic_id;
      get diagnostics user_roles_count = row_count;
    end if;
  end if;

  -- 11. Finally, delete the clinic itself
  delete from public.clinics where id = target_clinic_id;

  -- Return summary of deleted records
  deleted_counts := json_build_object(
    'patients', patients_count,
    'invoices', invoices_count,
    'payments', payments_count,
    'appointments', appointments_count,
    'visits', visits_count,
    'adjustments', adjustments_count,
    'inventory', inventory_count,
    'categories', categories_count,
    'treatment_types', treatment_types_count,
    'user_roles_deleted', user_roles_count
  );

  return deleted_counts;
end;
$$;

revoke all on function public.delete_clinic_cascade(uuid) from public;
grant execute on function public.delete_clinic_cascade(uuid) to authenticated;
