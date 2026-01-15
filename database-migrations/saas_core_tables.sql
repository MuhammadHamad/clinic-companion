-- Core multi-tenant tables + RLS policies for onboarding approval flow.

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  slug text unique
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null,
  clinic_id uuid references public.clinics(id) on delete set null
);

alter table public.clinics enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.is_super_admin()
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
      and ur.role = 'super_admin'
  );
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_role_check'
  ) then
    alter table public.user_roles
      add constraint user_roles_role_check
      check (role in ('admin','dentist','receptionist','super_admin'));
  end if;
end $$;

-- user_roles: users can read their own role, super_admin can manage all

drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_roles_manage_super_admin" on public.user_roles;
create policy "user_roles_manage_super_admin"
  on public.user_roles
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- clinics: normal users can read their own clinic, super_admin can manage all

drop policy if exists "clinics_select_own" on public.clinics;
create policy "clinics_select_own"
  on public.clinics
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role <> 'super_admin'
        and ur.clinic_id = public.clinics.id
    )
  );

drop policy if exists "clinics_manage_super_admin" on public.clinics;
create policy "clinics_manage_super_admin"
  on public.clinics
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create or replace function public.delete_auth_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;

  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  -- Delete app-side references first where applicable.
  delete from public.user_roles where user_id = target_user_id;
  delete from public.clinic_requests where auth_user_id = target_user_id;

  -- profiles table may exist in this app; remove it to avoid orphans.
  if to_regclass('public.profiles') is not null then
    execute 'delete from public.profiles where id = $1' using target_user_id;
  end if;

  -- Delete the auth user (prevents any future logins).
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.delete_auth_user(uuid) from public;
grant execute on function public.delete_auth_user(uuid) to authenticated;
