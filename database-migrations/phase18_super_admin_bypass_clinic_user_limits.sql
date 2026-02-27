create or replace function public.enforce_clinic_user_limits()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  clinic uuid;
  active_count int;
  other_admin_count int;
  remaining_admin_count int;
begin
  if public.is_super_admin() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.role = 'super_admin' or new.clinic_id is null then
      return new;
    end if;

    clinic := new.clinic_id;

    if tg_op = 'INSERT' or old.clinic_id is distinct from new.clinic_id then
      select count(*)
      into active_count
      from public.user_roles ur
      where ur.clinic_id = clinic
        and ur.role <> 'super_admin'
        and ur.user_id <> new.user_id;

      if active_count >= 3 then
        raise exception 'Clinic user limit reached (max 3 users per clinic).' using errcode = 'P0001';
      end if;
    end if;

    if new.role = 'admin' and (tg_op = 'INSERT' or old.role is distinct from new.role) then
      select count(*)
      into other_admin_count
      from public.user_roles ur
      where ur.clinic_id = clinic
        and ur.role = 'admin'
        and ur.user_id <> new.user_id;

      if other_admin_count >= 1 then
        raise exception 'Only 1 admin is allowed per clinic.' using errcode = 'P0001';
      end if;
    end if;

    if tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin' and old.clinic_id is not null then
      select count(*)
      into remaining_admin_count
      from public.user_roles ur
      where ur.clinic_id = old.clinic_id
        and ur.role = 'admin'
        and ur.user_id <> old.user_id;

      if remaining_admin_count = 0 then
        raise exception 'A clinic must have at least 1 admin.' using errcode = 'P0001';
      end if;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'admin' and old.clinic_id is not null then
      select count(*)
      into remaining_admin_count
      from public.user_roles ur
      where ur.clinic_id = old.clinic_id
        and ur.role = 'admin'
        and ur.user_id <> old.user_id;

      if remaining_admin_count = 0 then
        raise exception 'A clinic must have at least 1 admin.' using errcode = 'P0001';
      end if;
    end if;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_enforce_clinic_user_limits on public.user_roles;

create trigger trg_enforce_clinic_user_limits
before insert or update or delete on public.user_roles
for each row
execute function public.enforce_clinic_user_limits();
