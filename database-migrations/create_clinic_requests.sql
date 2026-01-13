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

create unique index if not exists clinic_requests_one_pending_per_auth_user
on public.clinic_requests (auth_user_id)
where auth_user_id is not null and status = 'pending';

create or replace function public.enforce_clinic_request_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rejected_count int;
begin
  if new.status is null then
    new.status := 'pending';
  end if;

  if lower(new.status) <> 'pending' then
    return new;
  end if;

  if new.auth_user_id is null then
    raise exception 'auth_user_id is required' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.clinic_requests
    where auth_user_id = new.auth_user_id
      and status = 'pending'
  ) then
    raise exception 'You already have a pending request.' using errcode = 'P0001';
  end if;

  select count(*)
  into rejected_count
  from public.clinic_requests
  where auth_user_id = new.auth_user_id
    and status = 'rejected';

  if rejected_count >= 3 then
    raise exception 'Too many rejected requests. Please use a different email or contact support.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_clinic_request_limits on public.clinic_requests;

create trigger trg_enforce_clinic_request_limits
before insert on public.clinic_requests
for each row
execute function public.enforce_clinic_request_limits();
