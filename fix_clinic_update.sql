-- Fix clinic name update permissions
-- Run this in your Supabase SQL Editor

-- Drop and recreate the clinic update policy to allow dentists to update clinic names
drop policy if exists "clinics_update_own_admin" on public.clinics;

create policy "clinics_update_own_admin"
  on public.clinics
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'dentist')
        and ur.clinic_id = public.clinics.id
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'dentist')
        and ur.clinic_id = public.clinics.id
    )
  );
