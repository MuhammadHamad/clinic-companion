-- Create a view that joins clinics with their admin emails for super admin convenience
-- This allows super admin to see which email belongs to each clinic admin

drop view if exists public.clinics_with_admin_email;

create view public.clinics_with_admin_email as
select
  c.id,
  c.name,
  c.slug,
  c.created_at,
  c.is_paused,
  c.paused_at,
  c.pause_reason,
  au.email as admin_email
from public.clinics c
left join public.user_roles ur
  on ur.clinic_id = c.id
  and ur.role = 'admin'
left join auth.users au
  on au.id = ur.user_id;

-- RLS: allow super admin to read this view
drop policy if exists "clinics_with_admin_email_select_super_admin" on public.clinics_with_admin_email;
create policy "clinics_with_admin_email_select_super_admin"
  on public.clinics_with_admin_email
  for select
  to authenticated
  using (public.is_super_admin());

grant select on public.clinics_with_admin_email to authenticated;

-- Make the view visible to PostgREST as a table-like resource
alter view public.clinics_with_admin_email set (schema = 'public');

-- Ensure PostgREST recognizes this view
comment on table public.clinics_with_admin_email is 'Clinics with admin email for super admin';
