-- Fix: clinic_admin_emails RLS was blocking regular admin users from reading
-- their own clinic row, which caused activeClinicId to become null and the
-- customer (patients) list to appear empty.
--
-- Root cause: phase20 / supabase_security_advisor_fixes.sql enabled RLS on
-- public.clinic_admin_emails, but only the super-admin select policy existed.
-- Any authenticated user who is NOT a super_admin could not read ANY row in
-- the table.  Because TenantContext used an `!inner` join on clinic_admin_emails
-- when loading the clinics table, zero rows were returned for regular admins →
-- activeClinicId became null → patients query returned nothing.
--
-- Fixes applied:
--   1. Add a select policy so clinic admins can read their OWN clinic row.
--   2. (Frontend fix already applied) Changed !inner → plain left join so a
--      missing/unreadable clinic_admin_emails row no longer excludes the clinic.

-- Allow a clinic's own admin (and any other staff member) to read the row
-- that belongs to their clinic.
drop policy if exists "clinic_admin_emails_select_own_clinic" on public.clinic_admin_emails;
create policy "clinic_admin_emails_select_own_clinic"
  on public.clinic_admin_emails
  for select
  to authenticated
  using (
    -- super_admin already covered by the existing policy; this covers everyone else
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id  = auth.uid()
        and ur.clinic_id = public.clinic_admin_emails.clinic_id
    )
  );
