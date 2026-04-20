-- Fix Supabase Security Advisor findings for clinic_admin_emails
-- - policy_exists_rls_disabled
-- - rls_disabled_in_public

alter table public.clinic_admin_emails enable row level security;

-- Keep/restore expected read policy for super admins.
drop policy if exists "clinic_admin_emails_select_super_admin" on public.clinic_admin_emails;
create policy "clinic_admin_emails_select_super_admin"
  on public.clinic_admin_emails
  for select
  to authenticated
  using (public.is_super_admin());
