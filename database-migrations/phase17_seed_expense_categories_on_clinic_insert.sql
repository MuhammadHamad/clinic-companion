create or replace function public.seed_default_expense_categories_internal(p_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_clinic_id is null then
    return;
  end if;

  if to_regclass('public.expense_categories') is null then
    return;
  end if;

  insert into public.expense_categories (clinic_id, name, is_system)
  values
    (p_clinic_id, 'Salaries', true),
    (p_clinic_id, 'Rent', true),
    (p_clinic_id, 'Electricity', true),
    (p_clinic_id, 'Internet', true),
    (p_clinic_id, 'Supplies', true),
    (p_clinic_id, 'Maintenance', true),
    (p_clinic_id, 'Marketing', true),
    (p_clinic_id, 'Misc', true)
  on conflict (clinic_id, name) do nothing;
end;
$$;

revoke all on function public.seed_default_expense_categories_internal(uuid) from public;

create or replace function public.trg_seed_default_expense_categories_on_clinic_insert()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if to_regclass('public.expense_categories') is null then
    return new;
  end if;

  perform public.seed_default_expense_categories_internal(new.id);
  return new;
end;
$$;

revoke all on function public.trg_seed_default_expense_categories_on_clinic_insert() from public;

do $$
begin
  if to_regclass('public.clinics') is null then
    return;
  end if;

  execute 'drop trigger if exists trg_seed_default_expense_categories_on_clinic_insert on public.clinics';
  execute 'create trigger trg_seed_default_expense_categories_on_clinic_insert after insert on public.clinics for each row execute function public.trg_seed_default_expense_categories_on_clinic_insert()';
end $$;
