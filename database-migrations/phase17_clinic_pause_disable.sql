do $$
begin
  if to_regclass('public.clinics') is null then
    raise exception 'clinics table does not exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinics'
      and column_name = 'is_paused'
  ) then
    alter table public.clinics add column is_paused boolean not null default false;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinics'
      and column_name = 'paused_at'
  ) then
    alter table public.clinics add column paused_at timestamptz;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinics'
      and column_name = 'pause_reason'
  ) then
    alter table public.clinics add column pause_reason text;
  end if;
end $$;

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
  join public.clinics c on c.id = ur.clinic_id
  where ur.user_id = auth.uid()
    and coalesce(c.is_paused, false) = false
  order by ur.created_at desc
  limit 1
$$;

alter table public.treatment_types enable row level security;

drop policy if exists "treatment_types_select_authenticated" on public.treatment_types;
drop policy if exists "treatment_types_manage_admin" on public.treatment_types;
drop policy if exists "tenant_isolation_select" on public.treatment_types;
drop policy if exists "tenant_isolation_modify" on public.treatment_types;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'treatment_types'
      and column_name = 'clinic_id'
  ) then
    create policy "tenant_isolation_select"
      on public.treatment_types
      for select
      to authenticated
      using (
        public.is_super_admin()
        or clinic_id = public.current_user_clinic_id()
      );

    create policy "tenant_isolation_modify"
      on public.treatment_types
      for all
      to authenticated
      using (
        public.is_super_admin()
        or (
          clinic_id = public.current_user_clinic_id()
          and exists (
            select 1
            from public.user_roles ur
            where ur.user_id = auth.uid()
              and ur.role in ('admin')
              and ur.clinic_id = clinic_id
          )
        )
      )
      with check (
        public.is_super_admin()
        or (
          clinic_id = public.current_user_clinic_id()
          and exists (
            select 1
            from public.user_roles ur
            where ur.user_id = auth.uid()
              and ur.role in ('admin')
              and ur.clinic_id = clinic_id
          )
        )
      );
  end if;
end $$;
