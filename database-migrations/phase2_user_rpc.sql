create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = auth
set row_security = off
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.get_auth_user_id_by_email(text) from public;
revoke execute on function public.get_auth_user_id_by_email(text) from authenticated;
revoke execute on function public.get_auth_user_id_by_email(text) from anon;
grant execute on function public.get_auth_user_id_by_email(text) to service_role;

create or replace function public.attach_user_to_clinic(
  p_user_id uuid,
  p_clinic_id uuid,
  p_role text
)
returns table(user_id uuid, role text, clinic_id uuid)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_existing_clinic_id uuid;
  v_existing_role text;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = 'P0001';
  end if;

  if p_clinic_id is null then
    raise exception 'clinic_id is required' using errcode = 'P0001';
  end if;

  if p_role is null or btrim(p_role) = '' then
    raise exception 'role is required' using errcode = 'P0001';
  end if;

  if p_role not in ('admin', 'dentist', 'receptionist') then
    raise exception 'Invalid role' using errcode = 'P0001';
  end if;

  select ur.clinic_id, ur.role
    into v_existing_clinic_id, v_existing_role
  from public.user_roles ur
  where ur.user_id = p_user_id;

  if found then
    if v_existing_clinic_id = p_clinic_id then
      raise exception 'User is already attached to this clinic.' using errcode = 'P0001';
    end if;

    if v_existing_clinic_id is not null and v_existing_clinic_id <> p_clinic_id then
      raise exception 'User is already attached to a different clinic.' using errcode = 'P0001';
    end if;

    return query
      update public.user_roles
        set clinic_id = p_clinic_id,
            role = p_role
      where user_id = p_user_id
      returning public.user_roles.user_id, public.user_roles.role, public.user_roles.clinic_id;
  end if;

  return query
    insert into public.user_roles (user_id, clinic_id, role)
    values (p_user_id, p_clinic_id, p_role)
    returning public.user_roles.user_id, public.user_roles.role, public.user_roles.clinic_id;
end;
$$;

revoke all on function public.attach_user_to_clinic(uuid, uuid, text) from public;
revoke execute on function public.attach_user_to_clinic(uuid, uuid, text) from authenticated;
revoke execute on function public.attach_user_to_clinic(uuid, uuid, text) from anon;
grant execute on function public.attach_user_to_clinic(uuid, uuid, text) to service_role;

create or replace function public.detach_user_from_clinic(
  p_user_id uuid,
  p_clinic_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_deleted_rows int;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = 'P0001';
  end if;

  if p_clinic_id is null then
    raise exception 'clinic_id is required' using errcode = 'P0001';
  end if;

  delete from public.user_roles
  where user_id = p_user_id
    and clinic_id = p_clinic_id;

  get diagnostics v_deleted_rows = row_count;
  return v_deleted_rows > 0;
end;
$$;

revoke all on function public.detach_user_from_clinic(uuid, uuid) from public;
revoke execute on function public.detach_user_from_clinic(uuid, uuid) from authenticated;
revoke execute on function public.detach_user_from_clinic(uuid, uuid) from anon;
grant execute on function public.detach_user_from_clinic(uuid, uuid) to service_role;

create or replace function public.list_clinic_users(p_clinic_id uuid)
returns table(
  user_id uuid,
  role text,
  clinic_id uuid,
  created_at timestamptz,
  email text,
  first_name text,
  last_name text
)
language sql
security definer
set search_path = public, auth
set row_security = off
as $$
  select
    ur.user_id,
    ur.role,
    ur.clinic_id,
    ur.created_at,
    au.email,
    (au.raw_user_meta_data ->> 'first_name')::text as first_name,
    (au.raw_user_meta_data ->> 'last_name')::text as last_name
  from public.user_roles ur
  join auth.users au on au.id = ur.user_id
  where ur.clinic_id = p_clinic_id
    and ur.role <> 'super_admin'
  order by ur.created_at desc;
$$;

revoke all on function public.list_clinic_users(uuid) from public;
revoke execute on function public.list_clinic_users(uuid) from authenticated;
revoke execute on function public.list_clinic_users(uuid) from anon;
grant execute on function public.list_clinic_users(uuid) to service_role;
