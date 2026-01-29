do $$
declare
  -- IMPORTANT: set this to the clinic that should own ALL existing legacy treatment types.
  -- This migration intentionally requires an explicit clinic_id to avoid mis-assigning data.
  -- Example:
  -- target_clinic_id uuid := '85d012a5-80d9-4d52-92f4-75a6c475f93b'::uuid;
  target_clinic_id uuid := null;
begin
  if target_clinic_id is null then
    raise exception 'target_clinic_id is not set. Edit this migration and set target_clinic_id to the intended clinic UUID.';
  end if;

  if not exists (select 1 from public.clinics c where c.id = target_clinic_id) then
    raise exception 'target_clinic_id % does not exist in public.clinics', target_clinic_id;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'treatment_types'
      and column_name = 'clinic_id'
  ) then
    alter table public.treatment_types add column clinic_id uuid;
  end if;

  update public.treatment_types
    set clinic_id = target_clinic_id
  where clinic_id is null;

  alter table public.treatment_types alter column clinic_id set not null;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'treatment_types_clinic_id_fkey'
  ) then
    alter table public.treatment_types
      add constraint treatment_types_clinic_id_fkey
      foreign key (clinic_id)
      references public.clinics(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'treatment_types'
      and indexname = 'treatment_types_clinic_id_idx'
  ) then
    execute 'create index treatment_types_clinic_id_idx on public.treatment_types (clinic_id)';
  end if;
end $$;

alter table public.treatment_types enable row level security;

drop policy if exists "treatment_types_select_authenticated" on public.treatment_types;
drop policy if exists "treatment_types_manage_admin" on public.treatment_types;
drop policy if exists "tenant_isolation_select" on public.treatment_types;
drop policy if exists "tenant_isolation_modify" on public.treatment_types;

create policy "tenant_isolation_select"
  on public.treatment_types
  for select
  to authenticated
  using (
    public.is_super_admin()
    or clinic_id in (
      select ur.clinic_id
      from public.user_roles ur
      where ur.user_id = auth.uid()
    )
  );

create policy "tenant_isolation_modify"
  on public.treatment_types
  for all
  to authenticated
  using (
    public.is_super_admin()
    or (
      clinic_id in (
        select ur.clinic_id
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role in ('admin')
      )
    )
  )
  with check (
    public.is_super_admin()
    or (
      clinic_id in (
        select ur.clinic_id
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role in ('admin')
      )
    )
  );
