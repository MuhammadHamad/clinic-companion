-- Allow clinic admins to update their own clinic information
-- This enables clinic admins to change the clinic name in Settings

drop policy if exists "clinics_update_admin" on public.clinics;
create policy "clinics_update_admin"
  on public.clinics
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
        and ur.clinic_id = public.clinics.id
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
        and ur.clinic_id = public.clinics.id
    )
  );
