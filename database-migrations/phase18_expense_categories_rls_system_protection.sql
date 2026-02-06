do $$
begin
  if to_regclass('public.expense_categories') is null then
    return;
  end if;

  drop policy if exists expense_categories_admin_only on public.expense_categories;

  drop policy if exists expense_categories_select_admin on public.expense_categories;
  create policy expense_categories_select_admin
    on public.expense_categories
    for select
    to authenticated
    using (
      public.is_super_admin()
      or public.is_clinic_admin(clinic_id)
    );

  drop policy if exists expense_categories_insert_admin on public.expense_categories;
  create policy expense_categories_insert_admin
    on public.expense_categories
    for insert
    to authenticated
    with check (
      public.is_super_admin()
      or (
        public.is_clinic_admin(clinic_id)
        and is_system = false
      )
    );

  drop policy if exists expense_categories_update_admin on public.expense_categories;
  create policy expense_categories_update_admin
    on public.expense_categories
    for update
    to authenticated
    using (
      public.is_super_admin()
      or (
        public.is_clinic_admin(clinic_id)
        and is_system = false
      )
    )
    with check (
      public.is_super_admin()
      or (
        public.is_clinic_admin(clinic_id)
        and is_system = false
      )
    );

  drop policy if exists expense_categories_delete_admin on public.expense_categories;
  create policy expense_categories_delete_admin
    on public.expense_categories
    for delete
    to authenticated
    using (
      public.is_super_admin()
      or (
        public.is_clinic_admin(clinic_id)
        and is_system = false
      )
    );
end $$;
