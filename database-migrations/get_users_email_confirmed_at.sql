create or replace function public.get_users_email_confirmed_at(user_ids uuid[])
returns table (user_id uuid, email_confirmed_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select u.id as user_id, u.email_confirmed_at
  from auth.users u
  where u.id = any(user_ids);
end;
$$;

grant execute on function public.get_users_email_confirmed_at(uuid[]) to authenticated;
