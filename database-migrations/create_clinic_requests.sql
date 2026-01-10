-- Creates pending clinic onboarding requests so super-admin can approve/reject.

create table if not exists public.clinic_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending',
  clinic_name text not null,
  city text,
  address text,
  phone text,
  owner_name text,
  owner_phone text,
  owner_email text,
  user_email text,
  auth_user_id uuid
);

alter table public.clinic_requests enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinic_requests_status_check'
  ) then
    alter table public.clinic_requests
      add constraint clinic_requests_status_check
      check (status in ('pending','approved','rejected'));
  end if;
end $$;

drop policy if exists "clinic_requests_insert_any" on public.clinic_requests;
create policy "clinic_requests_insert_any"
  on public.clinic_requests
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "clinic_requests_select_super_admin" on public.clinic_requests;
create policy "clinic_requests_select_super_admin"
  on public.clinic_requests
  for select
  to authenticated
  using (public.is_super_admin());

drop policy if exists "clinic_requests_select_own" on public.clinic_requests;
create policy "clinic_requests_select_own"
  on public.clinic_requests
  for select
  to authenticated
  using (
    auth_user_id = auth.uid()
    or user_email = (auth.jwt() ->> 'email')
    or owner_email = (auth.jwt() ->> 'email')
  );

drop policy if exists "clinic_requests_update_super_admin" on public.clinic_requests;
create policy "clinic_requests_update_super_admin"
  on public.clinic_requests
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
