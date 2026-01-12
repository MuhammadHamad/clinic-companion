create or replace function public.get_clinic_stats(clinic_ids uuid[])
returns table (
  clinic_id uuid,
  customers bigint,
  invoices bigint,
  staff bigint,
  outstanding numeric
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;

  return query
    with selected_clinics as (
      select unnest(clinic_ids) as clinic_id
    ),
    customer_counts as (
      select p.clinic_id, count(*)::bigint as customers
      from public.patients p
      where p.clinic_id = any (clinic_ids)
      group by p.clinic_id
    ),
    invoice_counts as (
      select i.clinic_id, count(*)::bigint as invoices
      from public.invoices i
      where i.clinic_id = any (clinic_ids)
      group by i.clinic_id
    ),
    staff_counts as (
      select ur.clinic_id, count(distinct ur.user_id)::bigint as staff
      from public.user_roles ur
      where ur.clinic_id = any (clinic_ids)
      group by ur.clinic_id
    ),
    outstanding_sums as (
      select p.clinic_id, coalesce(sum(p.balance), 0)::numeric as outstanding
      from public.patients p
      where p.clinic_id = any (clinic_ids)
        and coalesce(p.status::text, '') <> 'archived'
      group by p.clinic_id
    )
    select
      sc.clinic_id,
      coalesce(cc.customers, 0) as customers,
      coalesce(ic.invoices, 0) as invoices,
      coalesce(st.staff, 0) as staff,
      coalesce(os.outstanding, 0) as outstanding
    from selected_clinics sc
    left join customer_counts cc on cc.clinic_id = sc.clinic_id
    left join invoice_counts ic on ic.clinic_id = sc.clinic_id
    left join staff_counts st on st.clinic_id = sc.clinic_id
    left join outstanding_sums os on os.clinic_id = sc.clinic_id;
end;
$$;

revoke all on function public.get_clinic_stats(uuid[]) from public;
grant execute on function public.get_clinic_stats(uuid[]) to authenticated;
