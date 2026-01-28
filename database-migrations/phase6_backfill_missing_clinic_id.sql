do $$
begin
  if to_regclass('public.invoice_items') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'invoice_items'
         and column_name = 'clinic_id'
     )
  then
    update public.invoice_items ii
      set clinic_id = i.clinic_id
    from public.invoices i
    where ii.clinic_id is null
      and ii.invoice_id = i.id;
  end if;
end $$;

do $$
begin
  if to_regclass('public.payments') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'payments'
         and column_name = 'clinic_id'
     )
  then
    update public.payments p
      set clinic_id = i.clinic_id
    from public.invoices i
    where p.clinic_id is null
      and p.invoice_id = i.id;
  end if;
end $$;
