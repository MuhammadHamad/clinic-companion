-- ============================================================
-- DEV ENVIRONMENT ONLY — Delete all auth users & app-side data
-- ⚠️  DO NOT run this on the production Supabase project ⚠️
-- ============================================================

-- Step 1: Disable blocking triggers
alter table public.user_roles disable trigger trg_enforce_clinic_user_limits;
alter table public.user_roles disable trigger trg_update_clinic_admin_email_delete;

-- Step 2: Clear app-side tables with no FK cascade from auth.users
delete from public.clinic_requests;
delete from public.user_management_audit;
delete from public.clinic_admin_emails;

-- Step 3: Explicitly null out all known columns that might reference auth.users.
-- We use individual exception blocks so if a column or table doesn't exist, it simply skips.
DO $$ 
BEGIN 
  -- patients
  BEGIN UPDATE public.patients SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.patients SET updated_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  
  -- invoices
  BEGIN UPDATE public.invoices SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.invoices SET updated_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.invoices SET voided_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  
  -- invoice_adjustments
  BEGIN UPDATE public.invoice_adjustments SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  
  -- appointments
  BEGIN UPDATE public.appointments SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.appointments SET updated_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.appointments SET dentist_id = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  
  -- payments
  BEGIN UPDATE public.payments SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.payments SET updated_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  
  -- expenses
  BEGIN UPDATE public.expenses SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  
  -- inventory & stock
  BEGIN UPDATE public.inventory_items SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.stock_movements SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.stock_movements SET updated_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  
  -- visits & treatments
  BEGIN UPDATE public.visits SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.treatment_types SET created_by = NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Step 4: Delete all auth users (cascades to user_roles, profiles)
delete from auth.users;

-- Step 5: Re-enable triggers
alter table public.user_roles enable trigger trg_enforce_clinic_user_limits;
alter table public.user_roles enable trigger trg_update_clinic_admin_email_delete;

-- ============================================================
-- After running this script:
-- 1. Go to Supabase → Authentication → Users to confirm it's empty.
-- 2. Create your fresh account:
--    Dashboard → Authentication → Users → Add user
-- 3. Assign the super_admin role (paste the new user's UUID):
--
--   insert into public.user_roles (user_id, role, clinic_id)
--   values ('<paste-new-user-uuid-here>', 'super_admin', null);
-- ============================================================
