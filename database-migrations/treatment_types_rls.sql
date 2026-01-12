-- Enable RLS + allow authenticated users to manage treatment types (services)

alter table public.treatment_types enable row level security;

drop policy if exists "treatment_types_select_authenticated" on public.treatment_types;
create policy "treatment_types_select_authenticated"
  on public.treatment_types
  for select
  to authenticated
  using (true);

-- Only admins should manage the list
drop policy if exists "treatment_types_manage_admin" on public.treatment_types;
create policy "treatment_types_manage_admin"
  on public.treatment_types
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'super_admin')
    )
  );
