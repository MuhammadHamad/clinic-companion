create or replace function public.generate_due_recurring_expenses(p_clinic_id uuid, p_as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_inserted_total integer := 0;
  v_inserted integer := 0;
  v_last_due date;
  r public.recurring_expenses%rowtype;
begin
  if p_clinic_id is null then
    raise exception 'clinic_id is required';
  end if;

  if not (public.is_super_admin() or public.is_clinic_admin(p_clinic_id)) then
    raise exception 'not authorized';
  end if;

  for r in
    select *
    from public.recurring_expenses
    where clinic_id = p_clinic_id
      and is_active = true
      and next_due_date <= p_as_of
    order by next_due_date asc
    for update
  loop
    with due_dates as (
      select (gs)::date as due_date
      from generate_series(
        r.next_due_date::timestamptz,
        p_as_of::timestamptz,
        interval '1 month'
      ) gs
    ), ins as (
      insert into public.expenses (
        clinic_id,
        expense_date,
        amount,
        category_id,
        vendor_name,
        payment_method,
        description,
        notes,
        recurring_expense_id
      )
      select
        r.clinic_id,
        d.due_date,
        r.amount,
        r.category_id,
        r.vendor_name,
        r.payment_method,
        r.description,
        r.notes,
        r.id
      from due_dates d
      on conflict (recurring_expense_id, expense_date) do nothing
      returning 1
    )
    select
      (select count(*) from ins),
      (select max(due_date) from due_dates)
    into v_inserted, v_last_due;

    v_inserted_total := v_inserted_total + coalesce(v_inserted, 0);

    update public.recurring_expenses
      set next_due_date = (v_last_due + interval '1 month')::date,
          updated_at = now()
      where id = r.id;
  end loop;

  return v_inserted_total;
end;
$$;

revoke all on function public.generate_due_recurring_expenses(uuid, date) from public;
grant execute on function public.generate_due_recurring_expenses(uuid, date) to authenticated;
