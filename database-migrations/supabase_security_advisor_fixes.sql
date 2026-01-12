-- Fix Supabase Security Advisor critical findings

-- 1) Enable RLS on flagged tables
alter table public.visits enable row level security;
alter table public.invoice_adjustments enable row level security;

-- visits: admin-only access
drop policy if exists "visits_admin_only" on public.visits;
create policy "visits_admin_only"
  on public.visits
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'super_admin')
    )
  );

-- invoice_adjustments: admin-only access
drop policy if exists "invoice_adjustments_admin_only" on public.invoice_adjustments;
create policy "invoice_adjustments_admin_only"
  on public.invoice_adjustments
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'super_admin')
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'super_admin')
    )
  );

-- 2) Harden functions flagged as "Function Search Path Mutable"
-- Apply to any overloads in public schema.
do $$
declare
  r record;
begin
  for r in (
    select
      p.oid,
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('generate_invoice_number', 'generate_patient_number', 'update_inventory_status')
  ) loop
    execute format(
      'alter function %I.%I(%s) set search_path = public',
      r.schema_name,
      r.function_name,
      r.args
    );

    execute format(
      'alter function %I.%I(%s) security definer',
      r.schema_name,
      r.function_name,
      r.args
    );
  end loop;
end $$;
