do $$
begin
  if to_regrole('service_role') is null then
    raise exception 'Missing role: service_role';
  end if;

  if to_regrole('authenticated') is null then
    raise exception 'Missing role: authenticated';
  end if;

  if to_regrole('anon') is null then
    raise exception 'Missing role: anon';
  end if;

  if to_regprocedure('public.get_auth_user_id_by_email(text)') is null then
    raise exception 'Missing RPC: public.get_auth_user_id_by_email(text)';
  end if;

  if to_regprocedure('public.attach_user_to_clinic(uuid,uuid,text)') is null then
    raise exception 'Missing RPC: public.attach_user_to_clinic(uuid,uuid,text)';
  end if;

  if to_regprocedure('public.detach_user_from_clinic(uuid,uuid)') is null then
    raise exception 'Missing RPC: public.detach_user_from_clinic(uuid,uuid)';
  end if;

  if to_regprocedure('public.list_clinic_users(uuid)') is null then
    raise exception 'Missing RPC: public.list_clinic_users(uuid)';
  end if;

  if not has_function_privilege('service_role', 'public.get_auth_user_id_by_email(text)', 'EXECUTE') then
    raise exception 'service_role must have EXECUTE on public.get_auth_user_id_by_email(text)';
  end if;
  if not has_function_privilege('service_role', 'public.attach_user_to_clinic(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'service_role must have EXECUTE on public.attach_user_to_clinic(uuid,uuid,text)';
  end if;
  if not has_function_privilege('service_role', 'public.detach_user_from_clinic(uuid,uuid)', 'EXECUTE') then
    raise exception 'service_role must have EXECUTE on public.detach_user_from_clinic(uuid,uuid)';
  end if;
  if not has_function_privilege('service_role', 'public.list_clinic_users(uuid)', 'EXECUTE') then
    raise exception 'service_role must have EXECUTE on public.list_clinic_users(uuid)';
  end if;

  if has_function_privilege('authenticated', 'public.get_auth_user_id_by_email(text)', 'EXECUTE') then
    raise exception 'authenticated must NOT have EXECUTE on public.get_auth_user_id_by_email(text)';
  end if;
  if has_function_privilege('authenticated', 'public.attach_user_to_clinic(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'authenticated must NOT have EXECUTE on public.attach_user_to_clinic(uuid,uuid,text)';
  end if;
  if has_function_privilege('authenticated', 'public.detach_user_from_clinic(uuid,uuid)', 'EXECUTE') then
    raise exception 'authenticated must NOT have EXECUTE on public.detach_user_from_clinic(uuid,uuid)';
  end if;
  if has_function_privilege('authenticated', 'public.list_clinic_users(uuid)', 'EXECUTE') then
    raise exception 'authenticated must NOT have EXECUTE on public.list_clinic_users(uuid)';
  end if;

  if has_function_privilege('anon', 'public.get_auth_user_id_by_email(text)', 'EXECUTE') then
    raise exception 'anon must NOT have EXECUTE on public.get_auth_user_id_by_email(text)';
  end if;
  if has_function_privilege('anon', 'public.attach_user_to_clinic(uuid,uuid,text)', 'EXECUTE') then
    raise exception 'anon must NOT have EXECUTE on public.attach_user_to_clinic(uuid,uuid,text)';
  end if;
  if has_function_privilege('anon', 'public.detach_user_from_clinic(uuid,uuid)', 'EXECUTE') then
    raise exception 'anon must NOT have EXECUTE on public.detach_user_from_clinic(uuid,uuid)';
  end if;
  if has_function_privilege('anon', 'public.list_clinic_users(uuid)', 'EXECUTE') then
    raise exception 'anon must NOT have EXECUTE on public.list_clinic_users(uuid)';
  end if;
end;
$$;

do $$
declare
  v_trigger_exists boolean;
begin
  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'user_roles'
      and t.tgname = 'trg_enforce_clinic_user_limits'
      and not t.tgisinternal
  ) into v_trigger_exists;

  if not v_trigger_exists then
    raise exception 'Missing trigger: public.trg_enforce_clinic_user_limits on public.user_roles';
  end if;
end;
$$;
