import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks';
import { useTenant } from '@/contexts/TenantContext';
import type { Expense, ExpenseCategory, PaymentMethod, RecurringExpense } from '@/types';

type ExpenseCategoryRow = {
  id: string;
  clinic_id: string;
  name: string;
  is_system: boolean;
  created_at: string;
};

type ExpenseRow = {
  id: string;
  clinic_id: string;
  expense_date: string;
  amount: unknown;
  expense_type?: 'ad_hoc' | 'recurring' | null;
  is_recurring?: boolean | null;
  recurring_expense_id?: string | null;
  category_id: string | null;
  vendor_name: string | null;
  payment_method: PaymentMethod | null;
  description: string;
  notes: string | null;
  created_at: string;
  category?: ExpenseCategoryRow | null;
};

type RecurringExpenseRow = {
  id: string;
  clinic_id: string;
  next_due_date: string;
  amount: unknown;
  category_id: string | null;
  vendor_name: string | null;
  payment_method: PaymentMethod | null;
  description: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategoryRow | null;
};

type PostgrestErrorLike = { message?: string };

type ExpensesQueryParams = {
  start?: string;
  end?: string;
  categoryId?: string;
  search?: string;
};

const DEFAULT_CATEGORY_NAMES = [
  'Salaries',
  'Rent',
  'Electricity',
  'Internet',
  'Supplies',
  'Maintenance',
  'Marketing',
  'Misc',
];

export function useExpenses(options?: { autoFetch?: boolean }) {
  const autoFetch = options?.autoFetch ?? true;
  const { activeClinicId } = useTenant();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecurringLoading, setIsRecurringLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const mapRowToCategory = (row: unknown): ExpenseCategory => {
    const c = row as ExpenseCategoryRow;
    return {
      id: c.id,
      clinic_id: c.clinic_id,
      name: c.name,
      is_system: Boolean(c.is_system),
      created_at: c.created_at,
    };
  };

  const mapRowToExpense = (row: unknown): Expense => {
    const e = row as ExpenseRow;
    return {
      id: e.id,
      clinic_id: e.clinic_id,
      expense_date: e.expense_date,
      amount: Number(e.amount),
      expense_type: (e.expense_type || 'ad_hoc') as 'ad_hoc' | 'recurring',
      is_recurring: Boolean(e.is_recurring),
      recurring_expense_id: e.recurring_expense_id ?? null,
      category_id: e.category_id,
      vendor_name: e.vendor_name,
      payment_method: e.payment_method ?? null,
      description: e.description,
      notes: e.notes,
      created_at: e.created_at,
      category: e.category
        ? {
            id: e.category.id,
            clinic_id: e.category.clinic_id,
            name: e.category.name,
            is_system: Boolean(e.category.is_system),
            created_at: e.category.created_at,
          }
        : undefined,
    };
  };

  const mapRowToRecurringExpense = (row: unknown): RecurringExpense => {
    const r = row as RecurringExpenseRow;
    return {
      id: r.id,
      clinic_id: r.clinic_id,
      next_due_date: r.next_due_date,
      amount: Number(r.amount),
      category_id: r.category_id,
      vendor_name: r.vendor_name,
      payment_method: r.payment_method ?? null,
      description: r.description,
      notes: r.notes,
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      updated_at: r.updated_at,
      category: r.category
        ? {
            id: r.category.id,
            clinic_id: r.category.clinic_id,
            name: r.category.name,
            is_system: Boolean(r.category.is_system),
            created_at: r.category.created_at,
          }
        : undefined,
    };
  };

  const seedDefaultCategoriesIfMissing = useCallback(async () => {
    if (!activeClinicId) return;

    const { data: existing, error } = await supabase
      .from('expense_categories')
      .select('id, name')
      .eq('clinic_id', activeClinicId);

    if (error) throw error;

    const existingRows = (existing || []) as Array<{ name?: unknown }>;
    const existingNames = new Set<string>(existingRows.map((r) => String(r?.name || '').trim()));
    const toInsert = DEFAULT_CATEGORY_NAMES.filter((n) => !existingNames.has(n)).map((name) => ({
      clinic_id: activeClinicId,
      name,
      is_system: true,
    }));

    if (toInsert.length === 0) return;

    const { error: insertError } = await supabase.from('expense_categories').insert(toInsert);
    if (insertError) throw insertError;
  }, [activeClinicId]);

  const fetchCategories = useCallback(async () => {
    try {
      if (!activeClinicId) {
        setCategories([]);
        setLastUpdated(new Date());
        return;
      }

      await seedDefaultCategoriesIfMissing();

      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('clinic_id', activeClinicId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories((data || []).map(mapRowToCategory));
      setLastUpdated(new Date());
    } catch (error: unknown) {
      logger.error('Error fetching expense categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch expense categories',
        variant: 'destructive',
      });
    }
  }, [activeClinicId, seedDefaultCategoriesIfMissing, toast]);

  const fetchExpenses = useCallback(
    async (params?: ExpensesQueryParams) => {
      try {
        const isInitialLoad = !hasLoadedOnceRef.current;
        if (isInitialLoad) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }

        if (!activeClinicId) {
          setExpenses([]);
          setLastUpdated(new Date());
          return;
        }

        let query = supabase
          .from('expenses')
          .select('*, category:expense_categories(*)')
          .eq('clinic_id', activeClinicId)
          .order('expense_date', { ascending: false })
          .order('created_at', { ascending: false });

        const start = String(params?.start || '').trim();
        const end = String(params?.end || '').trim();
        const categoryId = String(params?.categoryId || '').trim();

        if (start) query = query.gte('expense_date', start);
        if (end) query = query.lte('expense_date', end);
        if (categoryId && categoryId !== 'all') query = query.eq('category_id', categoryId);

        const { data, error } = await query;
        if (error) throw error;

        const raw = (data || []).map(mapRowToExpense);

        const search = String(params?.search || '').trim().toLowerCase();
        const filtered = search
          ? raw.filter((e) => {
              const hay = `${e.description || ''} ${e.vendor_name || ''} ${e.notes || ''} ${e.category?.name || ''}`
                .toLowerCase()
                .trim();
              return hay.includes(search);
            })
          : raw;

        setExpenses(filtered);
        setLastUpdated(new Date());
        hasLoadedOnceRef.current = true;
      } catch (error: unknown) {
        logger.error('Error fetching expenses:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch expenses',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeClinicId, toast],
  );

  const updateCategory = useCallback(
    async (id: string, name: string) => {
      try {
        if (!activeClinicId) return { success: false };
        const categoryId = String(id || '').trim();
        const nextName = String(name || '').trim();
        if (!categoryId || !nextName) return { success: false };

        const { data, error } = await supabase
          .from('expense_categories')
          .update({ name: nextName })
          .eq('clinic_id', activeClinicId)
          .eq('id', categoryId)
          .select('*')
          .single();

        if (error) throw error;

        const updated = mapRowToCategory(data);
        setCategories((prev) => {
          const next = prev.map((c) => (c.id === categoryId ? updated : c));
          next.sort((a, b) => a.name.localeCompare(b.name));
          return next;
        });
        setLastUpdated(new Date());
        return { success: true };
      } catch (error: unknown) {
        logger.error('Error updating expense category:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to update category');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false };
      }
    },
    [activeClinicId, toast],
  );

  const fetchRecurringExpenses = useCallback(async () => {
    try {
      setIsRecurringLoading(true);

      if (!activeClinicId) {
        setRecurringExpenses([]);
        setLastUpdated(new Date());
        return;
      }

      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, category:expense_categories(*)')
        .eq('clinic_id', activeClinicId)
        .order('is_active', { ascending: false })
        .order('next_due_date', { ascending: true });

      if (error) throw error;
      setRecurringExpenses((data || []).map(mapRowToRecurringExpense));
      setLastUpdated(new Date());
    } catch (error: unknown) {
      logger.error('Error fetching recurring expenses:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch recurring expenses',
        variant: 'destructive',
      });
    } finally {
      setIsRecurringLoading(false);
    }
  }, [activeClinicId, toast]);

  const createRecurringExpense = useCallback(
    async (payload: Omit<RecurringExpense, 'id' | 'created_at' | 'updated_at' | 'clinic_id' | 'category'>) => {
      try {
        if (!activeClinicId) return { success: false };

        const { data, error } = await supabase
          .from('recurring_expenses')
          .insert({
            clinic_id: activeClinicId,
            next_due_date: payload.next_due_date,
            amount: payload.amount,
            category_id: payload.category_id || null,
            vendor_name: payload.vendor_name || null,
            payment_method: payload.payment_method || null,
            description: payload.description,
            notes: payload.notes || null,
            is_active: payload.is_active,
          })
          .select('*, category:expense_categories(*)')
          .single();

        if (error) throw error;

        const created = mapRowToRecurringExpense(data);
        setRecurringExpenses((prev) => [created, ...prev]);
        setLastUpdated(new Date());
        return { success: true, data: created };
      } catch (error: unknown) {
        logger.error('Error creating recurring expense:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to create recurring expense');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false };
      }
    },
    [activeClinicId, toast],
  );

  const updateRecurringExpense = useCallback(
    async (id: string, payload: Partial<Omit<RecurringExpense, 'id' | 'created_at' | 'updated_at' | 'clinic_id' | 'category'>>) => {
      try {
        if (!activeClinicId) return { success: false };
        const recurringId = String(id || '').trim();
        if (!recurringId) return { success: false };

        const { data, error } = await supabase
          .from('recurring_expenses')
          .update({
            next_due_date: payload.next_due_date,
            amount: payload.amount,
            category_id: payload.category_id === undefined ? undefined : payload.category_id || null,
            vendor_name: payload.vendor_name === undefined ? undefined : payload.vendor_name || null,
            payment_method: payload.payment_method === undefined ? undefined : payload.payment_method || null,
            description: payload.description,
            notes: payload.notes === undefined ? undefined : payload.notes || null,
            is_active: payload.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('clinic_id', activeClinicId)
          .eq('id', recurringId)
          .select('*, category:expense_categories(*)')
          .single();

        if (error) throw error;

        const updated = mapRowToRecurringExpense(data);
        setRecurringExpenses((prev) => prev.map((r) => (r.id === recurringId ? updated : r)));
        setLastUpdated(new Date());
        return { success: true, data: updated };
      } catch (error: unknown) {
        logger.error('Error updating recurring expense:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to update recurring expense');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false };
      }
    },
    [activeClinicId, toast],
  );

  const deleteRecurringExpense = useCallback(
    async (id: string) => {
      try {
        if (!activeClinicId) return { success: false };
        const recurringId = String(id || '').trim();
        if (!recurringId) return { success: false };

        const { error } = await supabase
          .from('recurring_expenses')
          .delete()
          .eq('clinic_id', activeClinicId)
          .eq('id', recurringId);

        if (error) throw error;

        setRecurringExpenses((prev) => prev.filter((r) => r.id !== recurringId));
        setLastUpdated(new Date());
        return { success: true };
      } catch (error: unknown) {
        logger.error('Error deleting recurring expense:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to delete recurring expense');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false };
      }
    },
    [activeClinicId, toast],
  );

  const generateDueRecurringExpenses = useCallback(
    async (asOfDate?: string) => {
      try {
        if (!activeClinicId) return { success: false, inserted: 0 };

        const args: { p_clinic_id: string; p_as_of?: string } = {
          p_clinic_id: activeClinicId,
        };
        const nextAsOf = String(asOfDate || '').trim();
        if (nextAsOf) args.p_as_of = nextAsOf;

        const { data, error } = await supabase.rpc('generate_due_recurring_expenses', args);

        if (error) throw error;

        const inserted = Number(data || 0);

        await Promise.allSettled([fetchRecurringExpenses(), fetchExpenses()]);

        toast({
          title: 'Recurring expenses generated',
          description: inserted > 0 ? `Created ${inserted} expense(s).` : 'No expenses were due.',
        });

        return { success: true, inserted };
      } catch (error: unknown) {
        logger.error('Error generating due recurring expenses:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to generate recurring expenses');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false, inserted: 0 };
      }
    },
    [activeClinicId, fetchExpenses, fetchRecurringExpenses, toast],
  );

  const createCategory = useCallback(
    async (name: string) => {
      try {
        if (!activeClinicId) return { success: false };
        const nextName = String(name || '').trim();
        if (!nextName) return { success: false };

        const { data, error } = await supabase
          .from('expense_categories')
          .insert({
            clinic_id: activeClinicId,
            name: nextName,
            is_system: false,
          })
          .select('*')
          .single();

        if (error) throw error;
        setCategories((prev) => {
          const next = [mapRowToCategory(data), ...prev];
          next.sort((a, b) => a.name.localeCompare(b.name));
          return next;
        });
        setLastUpdated(new Date());
        return { success: true };
      } catch (error: unknown) {
        logger.error('Error creating expense category:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to create category');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false };
      }
    },
    [activeClinicId, toast],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      try {
        if (!activeClinicId) return { success: false };
        const categoryId = String(id || '').trim();
        if (!categoryId) return { success: false };

        const { error } = await supabase
          .from('expense_categories')
          .delete()
          .eq('clinic_id', activeClinicId)
          .eq('id', categoryId);

        if (error) throw error;

        setCategories((prev) => prev.filter((c) => c.id !== categoryId));
        setExpenses((prev) => prev.map((e) => (e.category_id === categoryId ? { ...e, category_id: null, category: undefined } : e)));
        setLastUpdated(new Date());
        return { success: true };
      } catch (error: unknown) {
        logger.error('Error deleting expense category:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to delete category');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false };
      }
    },
    [activeClinicId, toast],
  );

  const createExpense = useCallback(
    async (payload: Omit<Expense, 'id' | 'created_at' | 'clinic_id' | 'category'>) => {
      try {
        if (!activeClinicId) return { success: false };

        const { data, error } = await supabase
          .from('expenses')
          .insert({
            clinic_id: activeClinicId,
            expense_date: payload.expense_date,
            amount: payload.amount,
            expense_type: payload.expense_type,
            is_recurring: payload.is_recurring ?? false,
            recurring_expense_id: payload.recurring_expense_id || null,
            category_id: payload.category_id || null,
            vendor_name: payload.vendor_name || null,
            payment_method: payload.payment_method || null,
            description: payload.description,
            notes: payload.notes || null,
          })
          .select('*, category:expense_categories(*)')
          .single();

        if (error) throw error;

        const created = mapRowToExpense(data);
        setExpenses((prev) => [created, ...prev]);
        setLastUpdated(new Date());
        return { success: true, data: created };
      } catch (error: unknown) {
        logger.error('Error creating expense:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to create expense');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false };
      }
    },
    [activeClinicId, toast],
  );

  const updateExpense = useCallback(
    async (id: string, payload: Partial<Omit<Expense, 'id' | 'created_at' | 'clinic_id' | 'category'>>) => {
      try {
        if (!activeClinicId) return { success: false };
        const expenseId = String(id || '').trim();
        if (!expenseId) return { success: false };

        const { data, error } = await supabase
          .from('expenses')
          .update({
            expense_date: payload.expense_date,
            amount: payload.amount,
            expense_type: payload.expense_type,
            is_recurring: payload.is_recurring,
            recurring_expense_id:
              payload.recurring_expense_id === undefined ? undefined : payload.recurring_expense_id || null,
            category_id: payload.category_id === undefined ? undefined : payload.category_id || null,
            vendor_name: payload.vendor_name === undefined ? undefined : payload.vendor_name || null,
            payment_method: payload.payment_method === undefined ? undefined : payload.payment_method || null,
            description: payload.description,
            notes: payload.notes === undefined ? undefined : payload.notes || null,
          })
          .eq('clinic_id', activeClinicId)
          .eq('id', expenseId)
          .select('*, category:expense_categories(*)')
          .single();

        if (error) throw error;

        const updated = mapRowToExpense(data);
        setExpenses((prev) => prev.map((e) => (e.id === expenseId ? updated : e)));
        setLastUpdated(new Date());
        return { success: true, data: updated };
      } catch (error: unknown) {
        logger.error('Error updating expense:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to update expense');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false };
      }
    },
    [activeClinicId, toast],
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      try {
        if (!activeClinicId) return { success: false };
        const expenseId = String(id || '').trim();
        if (!expenseId) return { success: false };

        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('clinic_id', activeClinicId)
          .eq('id', expenseId);

        if (error) throw error;

        setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
        setLastUpdated(new Date());
        return { success: true };
      } catch (error: unknown) {
        logger.error('Error deleting expense:', error);
        const msg = String((error as PostgrestErrorLike)?.message || 'Failed to delete expense');
        toast({
          title: 'Error',
          description: msg,
          variant: 'destructive',
        });
        return { success: false };
      }
    },
    [activeClinicId, toast],
  );

  useEffect(() => {
    if (!autoFetch) return;
    fetchCategories();
    fetchExpenses();
    fetchRecurringExpenses();
  }, [autoFetch, fetchCategories, fetchExpenses, fetchRecurringExpenses]);

  return {
    expenses,
    categories,
    recurringExpenses,
    isLoading,
    isRecurringLoading,
    isRefreshing,
    lastUpdated,
    fetchExpenses,
    fetchCategories,
    fetchRecurringExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    createCategory,
    updateCategory,
    deleteCategory,
    createRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    generateDueRecurringExpenses,
  };
}
