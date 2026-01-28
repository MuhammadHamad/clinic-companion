create table if not exists public.user_management_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('create_user','attach_user','update_role','remove_user')),
  old_role text,
  new_role text,
  target_email text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists user_management_audit_clinic_id_created_at_idx
  on public.user_management_audit (clinic_id, created_at desc);

create index if not exists user_management_audit_actor_user_id_created_at_idx
  on public.user_management_audit (actor_user_id, created_at desc);

create index if not exists user_management_audit_target_user_id_created_at_idx
  on public.user_management_audit (target_user_id, created_at desc);

alter table public.user_management_audit enable row level security;

drop policy if exists user_management_audit_select_admin on public.user_management_audit;
create policy user_management_audit_select_admin
  on public.user_management_audit
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
        and ur.clinic_id = public.user_management_audit.clinic_id
    )
  );

create or replace function public.log_user_management_event(
  p_clinic_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_target_user_id uuid default null,
  p_old_role text default null,
  p_new_role text default null,
  p_target_email text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_clinic_id is null then
    raise exception 'clinic_id is required' using errcode = 'P0001';
  end if;

  if p_actor_user_id is null then
    raise exception 'actor_user_id is required' using errcode = 'P0001';
  end if;

  if p_action is null or btrim(p_action) = '' then
    raise exception 'action is required' using errcode = 'P0001';
  end if;

  insert into public.user_management_audit (
    clinic_id,
    actor_user_id,
    target_user_id,
    action,
    old_role,
    new_role,
    target_email,
    metadata
  ) values (
    p_clinic_id,
    p_actor_user_id,
    p_target_user_id,
    p_action,
    p_old_role,
    p_new_role,
    p_target_email,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_user_management_event(uuid, uuid, text, uuid, text, text, text, jsonb) from public;
revoke execute on function public.log_user_management_event(uuid, uuid, text, uuid, text, text, text, jsonb) from authenticated;
revoke execute on function public.log_user_management_event(uuid, uuid, text, uuid, text, text, text, jsonb) from anon;
grant execute on function public.log_user_management_event(uuid, uuid, text, uuid, text, text, text, jsonb) to service_role;
