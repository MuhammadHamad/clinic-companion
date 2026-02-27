-- Alternative: Create a table that stores admin email for each clinic
-- Updated via trigger when user_roles change

drop table if exists public.clinic_admin_emails;

create table public.clinic_admin_emails (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  admin_email text,
  updated_at timestamptz not null default now()
);

-- RLS: allow super admin to read this table
create policy "clinic_admin_emails_select_super_admin"
  on public.clinic_admin_emails
  for select
  to authenticated
  using (public.is_super_admin());

grant select on public.clinic_admin_emails to authenticated;

-- Function to update admin email when user_roles change
create or replace function public.update_clinic_admin_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.role = 'admin' then
      insert into public.clinic_admin_emails (clinic_id, admin_email)
      values (new.clinic_id, (select email from auth.users where id = new.user_id))
      on conflict (clinic_id) do update set
        admin_email = excluded.admin_email,
        updated_at = now();
    end if;
    return new;
  end if;
  
  if tg_op = 'DELETE' then
    if old.role = 'admin' then
      delete from public.clinic_admin_emails where clinic_id = old.clinic_id;
    end if;
    return old;
  end if;
  
  return null;
end;
$$;

-- Triggers to keep admin email in sync
drop trigger if exists trg_update_clinic_admin_email_insert on public.user_roles;
create trigger trg_update_clinic_admin_email_insert
after insert or update on public.user_roles
for each row
execute function public.update_clinic_admin_email();

drop trigger if exists trg_update_clinic_admin_email_delete on public.user_roles;
create trigger trg_update_clinic_admin_email_delete
after delete on public.user_roles
for each row
execute function public.update_clinic_admin_email();

-- Initial data population
insert into public.clinic_admin_emails (clinic_id, admin_email)
select 
  ur.clinic_id,
  au.email
from public.user_roles ur
join auth.users au on au.id = ur.user_id
where ur.role = 'admin'
on conflict (clinic_id) do update set
  admin_email = excluded.admin_email,
  updated_at = now();
