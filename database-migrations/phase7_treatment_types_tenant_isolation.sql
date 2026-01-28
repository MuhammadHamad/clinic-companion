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
  end if;
end $$;
