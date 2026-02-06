import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useExpenses, useUserRole } from '@/hooks';
import type { Expense, PaymentMethod, ExpenseType, RecurringExpense } from '@/types';
import { Plus, RefreshCw, Trash2, Pencil, TrendingUp, ChevronLeft, ChevronRight, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

 const formatDateInputValue = (date: Date) => {
   const y = date.getFullYear();
   const m = String(date.getMonth() + 1).padStart(2, '0');
   const d = String(date.getDate()).padStart(2, '0');
   return `${y}-${m}-${d}`;
 };

type ExpenseFormState = {
  expense_date: string;
  amount: string;
  expense_type: ExpenseType;
  category_id: string;
  vendor_name: string;
  payment_method: PaymentMethod;
  description: string;
  notes: string;
  is_recurring: boolean;
};

const emptyForm = (): ExpenseFormState => ({
  expense_date: formatDateInputValue(new Date()),
  amount: '',
  expense_type: 'ad_hoc',
  category_id: 'none',
  vendor_name: '',
  payment_method: 'cash',
  description: '',
  notes: '',
  is_recurring: false,
});

export default function Utilities() {
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();

  const {
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
  } = useExpenses({ autoFetch: false });


  // Monthly view state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  const [filters, setFilters] = useState<{ start: string; end: string; categoryId: string; search: string }>(() => {
    const today = new Date();
    const start = formatDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1));
    const end = formatDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    return {
      start,
      end,
      categoryId: 'all',
      search: '',
    };
  });

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [expenseDialogMode, setExpenseDialogMode] = useState<'create' | 'edit'>('create');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(() => emptyForm());

  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

  const [isQuickAddDialogOpen, setIsQuickAddDialogOpen] = useState(false);
  const [quickAddRecurringExpenseId, setQuickAddRecurringExpenseId] = useState<string | null>(null);
  const [quickAddForm, setQuickAddForm] = useState<ExpenseFormState>(() => emptyForm());

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState<{
    next_due_date: string;
    amount: string;
    category_id: string;
    vendor_name: string;
    payment_method: PaymentMethod;
    description: string;
    notes: string;
    is_active: boolean;
  }>(() => ({
    next_due_date: formatDateInputValue(new Date()),
    amount: '',
    category_id: 'none',
    vendor_name: '',
    payment_method: 'cash',
    description: '',
    notes: '',
    is_active: true,
  }));

  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<ExpenseType>('ad_hoc');

  const isExpenseSaveDisabled = useMemo(() => {
    const amount = Number(expenseForm.amount);
    return !expenseForm.expense_date || expenseForm.category_id === 'none' || !Number.isFinite(amount);
  }, [expenseForm.amount, expenseForm.category_id, expenseForm.expense_date]);

  // Month navigation helpers
  const goToPreviousMonth = () => {
    setSelectedMonth((prev) => {
      const newMonth = prev.month === 0 ? 11 : prev.month - 1;
      const newYear = prev.month === 0 ? prev.year - 1 : prev.year;
      return { year: newYear, month: newMonth };
    });
  };

  const goToNextMonth = () => {
    setSelectedMonth((prev) => {
      const newMonth = prev.month === 11 ? 0 : prev.month + 1;
      const newYear = prev.month === 11 ? prev.year + 1 : prev.year;
      return { year: newYear, month: newMonth };
    });
  };

  const goToCurrentMonth = () => {
    const today = new Date();
    setSelectedMonth({ year: today.getFullYear(), month: today.getMonth() });
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month, 1).toLocaleString('en-US', { month: 'long' });
  };

  const getDefaultExpenseDateForSelectedMonth = () => {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === selectedMonth.year && today.getMonth() === selectedMonth.month;
    if (isCurrentMonth) return formatDateInputValue(today);
    return formatDateInputValue(new Date(selectedMonth.year, selectedMonth.month, 1));
  };

  const openQuickAddFromTemplate = (template: RecurringExpense) => {
    const dateInSelectedMonth = getDefaultExpenseDateForSelectedMonth();
    setQuickAddRecurringExpenseId(template.id);
    setQuickAddForm({
      expense_date: dateInSelectedMonth,
      amount: String(template.amount),
      expense_type: 'recurring',
      category_id: template.category_id || 'none',
      vendor_name: template.vendor_name || '',
      payment_method: template.payment_method || 'cash',
      description: template.description,
      notes: template.notes || '',
      is_recurring: true,
    });
    setIsQuickAddDialogOpen(true);
  };

  const handleSaveQuickAdd = async () => {
    const amount = Number(quickAddForm.amount);
    if (!quickAddForm.expense_date || quickAddForm.category_id === 'none' || !Number.isFinite(amount)) return;

    const quickCategoryName = categories.find((c) => c.id === quickAddForm.category_id)?.name;
    const quickDescription = quickAddForm.description.trim() || quickCategoryName || 'Expense';

    const payload: Omit<Expense, 'id' | 'created_at' | 'clinic_id' | 'category'> = {
      expense_date: quickAddForm.expense_date,
      amount,
      expense_type: quickAddRecurringExpenseId ? 'recurring' : quickAddForm.expense_type,
      category_id: quickAddForm.category_id === 'none' ? null : quickAddForm.category_id,
      vendor_name: quickAddForm.vendor_name.trim() || null,
      payment_method: quickAddForm.payment_method,
      description: quickDescription,
      notes: quickAddForm.notes.trim() || null,
      is_recurring: quickAddForm.is_recurring,
      recurring_expense_id: quickAddRecurringExpenseId,
    };

    const res = await createExpense(payload);
    if (res.success) {
      setIsQuickAddDialogOpen(false);
      setQuickAddRecurringExpenseId(null);
    }
  };

  // Update filters when selected month changes
  useEffect(() => {
    const start = formatDateInputValue(new Date(selectedMonth.year, selectedMonth.month, 1));
    const end = formatDateInputValue(new Date(selectedMonth.year, selectedMonth.month + 1, 0));
    setFilters((prev) => ({ ...prev, start, end }));
  }, [selectedMonth]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchCategories();
    void fetchRecurringExpenses();
    void fetchExpenses({
      start: filters.start,
      end: filters.end,
      categoryId: filters.categoryId,
      search: filters.search,
    });
  }, [fetchCategories, fetchExpenses, fetchRecurringExpenses, filters.categoryId, filters.end, filters.search, filters.start, isAdmin]);

  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount), 0), [expenses]);

  const templateStatusList = useMemo(() => {
    const activeTemplates = recurringExpenses.filter((t) => t.is_active);
    return activeTemplates
      .map((template) => {
        const instances = expenses
          .filter((e) => e.recurring_expense_id === template.id)
          .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
        const totalPaid = instances.reduce((sum, e) => sum + Number(e.amount), 0);
        const isPaid = instances.length > 0;
        const latestExpense = instances[0];
        return {
          template,
          isPaid,
          totalPaid,
          expenseCount: instances.length,
          latestExpense,
          instances,
        };
      })
      .sort((a, b) => a.template.description.localeCompare(b.template.description));
  }, [expenses, recurringExpenses]);

  const paidCount = templateStatusList.filter((c) => c.isPaid).length;
  const unpaidCount = templateStatusList.filter((c) => !c.isPaid).length;
  
  // This memo is no longer needed since we filter by expense_type in the UI
  // Keeping it for backwards compatibility but it's not used
  const adHocExpenses = useMemo(() => {
    return expenses.filter((e) => e.expense_type === 'ad_hoc');
  }, [expenses]);

  const openCreateExpense = () => {
    setExpenseDialogMode('create');
    setEditingExpenseId(null);
    setExpenseForm({ ...emptyForm(), expense_type: expenseTypeFilter, is_recurring: expenseTypeFilter === 'recurring' });
    setIsExpenseDialogOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setExpenseDialogMode('edit');
    setEditingExpenseId(expense.id);
    setExpenseForm({
      expense_date: expense.expense_date,
      amount: String(expense.amount),
      expense_type: expense.expense_type,
      category_id: expense.category_id || 'none',
      vendor_name: expense.vendor_name || '',
      payment_method: expense.payment_method || 'cash',
      description: expense.description,
      notes: expense.notes || '',
      is_recurring: expense.expense_type === 'recurring',
    });
    setIsExpenseDialogOpen(true);
  };

  const handleSaveExpense = async () => {
    const amount = Number(expenseForm.amount);
    if (!expenseForm.expense_date || expenseForm.category_id === 'none' || !Number.isFinite(amount)) return;

    const categoryName = categories.find((c) => c.id === expenseForm.category_id)?.name;
    const description = expenseForm.description.trim() || categoryName || 'Expense';

    const existingEditingExpense = editingExpenseId ? expenses.find((e) => e.id === editingExpenseId) : undefined;

    const payload: Omit<Expense, 'id' | 'created_at' | 'clinic_id' | 'category'> = {
      expense_date: expenseForm.expense_date,
      amount,
      expense_type: expenseForm.expense_type,
      category_id: expenseForm.category_id === 'none' ? null : expenseForm.category_id,
      vendor_name: expenseForm.vendor_name.trim() || null,
      payment_method: expenseForm.payment_method,
      description,
      notes: expenseForm.notes.trim() || null,
      is_recurring: expenseForm.expense_type === 'recurring',
      recurring_expense_id: existingEditingExpense?.recurring_expense_id ?? null,
    };

    if (expenseDialogMode === 'create') {
      if (payload.expense_type === 'recurring') {
        const keyDesc = payload.description.trim().toLowerCase();
        const keyCat = payload.category_id ?? null;

        const existingTemplate = recurringExpenses.find((t) => {
          const tDesc = String(t.description || '').trim().toLowerCase();
          const tCat = t.category_id ?? null;
          return t.is_active && tDesc === keyDesc && tCat === keyCat;
        });

        let templateId = existingTemplate?.id ?? null;
        if (!templateId) {
          const templatePayload: Omit<RecurringExpense, 'id' | 'created_at' | 'updated_at' | 'clinic_id' | 'category'> = {
            next_due_date: payload.expense_date,
            amount: payload.amount,
            category_id: payload.category_id,
            vendor_name: payload.vendor_name,
            payment_method: payload.payment_method,
            description: payload.description,
            notes: payload.notes ?? null,
            is_active: true,
          };
          const createdTemplate = await createRecurringExpense(templatePayload);
          if (!createdTemplate.success || !createdTemplate.data?.id) return;
          templateId = createdTemplate.data.id;
        }

        const res = await createExpense({
          ...payload,
          recurring_expense_id: templateId,
          expense_type: 'recurring',
          is_recurring: true,
        });
        if (res.success) setIsExpenseDialogOpen(false);
        return;
      }

      const res = await createExpense(payload);
      if (res.success) setIsExpenseDialogOpen(false);
      return;
    }

    if (expenseDialogMode === 'edit' && editingExpenseId) {
      const res = await updateExpense(editingExpenseId, payload);
      if (res.success) setIsExpenseDialogOpen(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.allSettled([
      fetchCategories(),
      fetchRecurringExpenses(),
      fetchExpenses({
        start: filters.start,
        end: filters.end,
        categoryId: filters.categoryId,
        search: filters.search,
      }),
    ]);
  };

  const handleSaveTemplate = async () => {
    const amount = Number(templateForm.amount);
    if (!templateForm.next_due_date || templateForm.category_id === 'none' || !Number.isFinite(amount)) return;

    const templateCategoryName = categories.find((c) => c.id === templateForm.category_id)?.name;
    const templateDescription = templateForm.description.trim() || templateCategoryName || 'Recurring expense';

    const payload: Omit<RecurringExpense, 'id' | 'created_at' | 'updated_at' | 'clinic_id' | 'category'> = {
      next_due_date: templateForm.next_due_date,
      amount,
      category_id: templateForm.category_id === 'none' ? null : templateForm.category_id,
      vendor_name: templateForm.vendor_name.trim() || null,
      payment_method: templateForm.payment_method,
      description: templateDescription,
      notes: templateForm.notes.trim() || null,
      is_active: templateForm.is_active,
    };

    const res = await createRecurringExpense(payload);
    if (res.success) {
      setIsTemplateDialogOpen(false);
      setTemplateForm({
        next_due_date: formatDateInputValue(new Date()),
        amount: '',
        category_id: 'none',
        vendor_name: '',
        payment_method: 'cash',
        description: '',
        notes: '',
        is_active: true,
      });
    }
  };

  if (isRoleLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Utilities" subtitle="Track your clinic expenses" />
        <div className="p-6">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen">
      <Header title="Utilities" subtitle="Track your clinic expenses" />

      <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <Card className="w-full sm:w-auto">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total (Selected Range)</p>
                    <p className="text-xl font-bold">Rs. {totalExpenses.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-end gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className={cn('border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary')}
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={openCreateExpense}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={expenseTypeFilter} onValueChange={(v) => setExpenseTypeFilter(v as ExpenseType)}>
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-transparent p-1 rounded-lg gap-2">
                <TabsTrigger
                  value="ad_hoc"
                  className={cn(
                    'transition-colors',
                    'bg-transparent shadow-sm border border-border/60 hover:bg-muted/30',
                    '!data-[state=active]:bg-primary !data-[state=active]:text-white data-[state=active]:border-primary/40 data-[state=active]:shadow-md dark:!data-[state=active]:text-primary-foreground',
                    'dark:bg-transparent dark:hover:bg-muted/10 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]'
                  )}
                >
                  Ad-hoc Expenses
                </TabsTrigger>
                <TabsTrigger
                  value="recurring"
                  className={cn(
                    'transition-colors',
                    'bg-transparent shadow-sm border border-border/60 hover:bg-muted/30',
                    '!data-[state=active]:bg-primary !data-[state=active]:text-white data-[state=active]:border-primary/40 data-[state=active]:shadow-md dark:!data-[state=active]:text-primary-foreground',
                    'dark:bg-transparent dark:hover:bg-muted/10 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]'
                  )}
                >
                  Recurring Expenses
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ad_hoc" className="space-y-4">
                {/* Ad-hoc expenses list */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adHocExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                            No ad-hoc expenses yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        adHocExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell>{new Date(expense.expense_date).toLocaleDateString()}</TableCell>
                            <TableCell>{expense.description}</TableCell>
                            <TableCell>{expense.category?.name || '-'}</TableCell>
                            <TableCell className="text-right">Rs. {expense.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => openEditExpense(expense)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteExpenseId(expense.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="recurring" className="space-y-4">
                {/* Month Navigation */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                  <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div className="text-center">
                      <h3 className="text-lg font-semibold">
                        {getMonthName(selectedMonth.month)} {selectedMonth.year}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {paidCount} paid • {unpaidCount} unpaid
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={goToCurrentMonth}
                      className="text-xs"
                    >
                      Today
                    </Button>
                    <Button variant="outline" size="sm" onClick={goToNextMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button variant="outline" size="sm" onClick={() => setIsTemplateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Template
                  </Button>
                </div>

                {isLoading || isRecurringLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : templateStatusList.length === 0 ? (
                  <Card>
                    <CardContent className="p-10 text-center">
                      <p className="text-muted-foreground">No templates yet. Create templates to reuse every month.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templateStatusList.map((item) => (
                      <Card
                        key={item.template.id}
                        className={cn(
                          'transition-all',
                          item.isPaid
                            ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20 opacity-70 cursor-not-allowed'
                            : 'border-border hover:border-primary/50 hover:shadow-md cursor-pointer'
                        )}
                        onClick={() => {
                          if (item.isPaid) return;
                          openQuickAddFromTemplate(item.template);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {item.isPaid ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground" />
                              )}
                              <h4 className="font-semibold text-sm">{item.template.description}</h4>
                            </div>
                            {item.isPaid && (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                Paid
                              </span>
                            )}
                          </div>

                          {item.isPaid ? (
                            <div className="space-y-1">
                              <p className="text-xl font-bold text-green-700 dark:text-green-400">
                                Rs. {item.totalPaid.toLocaleString()}
                              </p>
                              {item.latestExpense && (
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  <p>Paid on: {new Date(item.latestExpense.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                  {item.latestExpense.vendor_name && (
                                    <p>Vendor: {item.latestExpense.vendor_name}</p>
                                  )}
                                  {item.expenseCount > 1 && (
                                    <p className="text-primary">{item.expenseCount} payments this month</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">Not paid yet</p>
                              <p className="text-xs text-muted-foreground">Click to pay for this month</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* All Expenses List - Collapsible */}
                {expenses.filter((e) => e.expense_type === 'recurring').length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer list-none">
                      <Card className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                              <span className="font-medium text-sm">View all {expenses.filter((e) => e.expense_type === 'recurring').length} recurring expense(s) for this month</span>
                            </div>
                            <span className="text-xs text-muted-foreground">Click to expand</span>
                          </div>
                        </CardContent>
                      </Card>
                    </summary>
                    
                    <div className="mt-4 rounded-lg border border-border overflow-hidden overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="w-[120px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expenses.filter((e) => e.expense_type === 'recurring').map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="whitespace-nowrap">{e.expense_date}</TableCell>
                              <TableCell className="max-w-[420px] truncate" title={e.description}>
                                {e.description}
                              </TableCell>
                              <TableCell>{e.category?.name || '-'}</TableCell>
                              <TableCell>{e.vendor_name || '-'}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">Rs. {Number(e.amount).toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="outline" size="icon" onClick={() => openEditExpense(e)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="destructive" size="icon" onClick={() => setDeleteExpenseId(e.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{expenseDialogMode === 'create' ? 'Add Expense' : 'Edit Expense'}</DialogTitle>
            <DialogDescription>Track clinic expenses like salaries, bills, and supplies.</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveExpense();
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, expense_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Expense Type *</Label>
                <Select
                  value={expenseForm.expense_type}
                  onValueChange={(v) => setExpenseForm((p) => ({ ...p, expense_type: v as ExpenseType }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ad_hoc">Ad-hoc (Miscellaneous/Daily)</SelectItem>
                    <SelectItem value="recurring">Recurring (Monthly Bills)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Category *</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={expenseForm.category_id}
                    onValueChange={(v) => {
                      setExpenseForm((p) => ({ ...p, category_id: v }));
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" type="button" title="Add new category">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px] max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Category</DialogTitle>
                        <DialogDescription>Create a new expense category.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Category Name</Label>
                          <Input
                            placeholder="e.g., Water bill"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const name = newCategoryName.trim();
                                if (name) {
                                  void createCategory(name).then((res) => {
                                    if (res.success) {
                                      setNewCategoryName('');
                                    }
                                  });
                                }
                              }
                            }}
                          />
                        </div>
                        <Button
                          onClick={async () => {
                            const name = newCategoryName.trim();
                            if (!name) return;
                            const res = await createCategory(name);
                            if (res.success) {
                              setNewCategoryName('');
                            }
                          }}
                          className="w-full"
                        >
                          Add Category
                        </Button>

                        {categories.length > 0 && (
                          <div className="pt-2 border-t border-border">
                            <div className="text-sm font-medium mb-2">Manage Categories</div>
                            <div className="space-y-2">
                              {categories.map((c) => (
                                <div key={c.id} className="flex items-center gap-2">
                                  {editingCategoryId === c.id ? (
                                    <Input
                                      className="flex-1"
                                      value={editingCategoryName}
                                      onChange={(e) => setEditingCategoryName(e.target.value)}
                                    />
                                  ) : (
                                    <div className="flex-1 text-sm truncate" title={c.name}>
                                      {c.name}
                                    </div>
                                  )}

                                  {editingCategoryId === c.id ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        onClick={async () => {
                                          const nextName = editingCategoryName.trim();
                                          if (!nextName) return;
                                          const res = await updateCategory(c.id, nextName);
                                          if (res.success) {
                                            setEditingCategoryId(null);
                                            setEditingCategoryName('');
                                          }
                                        }}
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        onClick={() => {
                                          setEditingCategoryId(null);
                                          setEditingCategoryName('');
                                        }}
                                      >
                                        <Circle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        disabled={c.is_system}
                                        title={c.is_system ? 'System categories cannot be edited' : 'Edit category'}
                                        onClick={() => {
                                          setEditingCategoryId(c.id);
                                          setEditingCategoryName(c.name);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        type="button"
                                        disabled={c.is_system}
                                        title={c.is_system ? 'System categories cannot be deleted' : 'Delete category'}
                                        onClick={() => setDeleteCategoryId(c.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select
                  value={expenseForm.payment_method}
                  onValueChange={(v) => setExpenseForm((p) => ({ ...p, payment_method: v as PaymentMethod }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="mobile_wallet">Mobile Wallet</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Input
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Assistant salary"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Vendor / Paid To</Label>
                <Input
                  value={expenseForm.vendor_name}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, vendor_name: e.target.value }))}
                  placeholder="e.g. Electricity company"
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => setIsExpenseDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isExpenseSaveDisabled}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteExpenseId} onOpenChange={(open) => !open && setDeleteExpenseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteExpenseId) return;
                const id = deleteExpenseId;
                setDeleteExpenseId(null);
                await deleteExpense(id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isQuickAddDialogOpen} onOpenChange={setIsQuickAddDialogOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Add Expense</DialogTitle>
            <DialogDescription>
              Add a new expense based on this template. Modify any details as needed.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveQuickAdd();
            }}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={quickAddForm.expense_date}
                    onChange={(e) => setQuickAddForm((p) => ({ ...p, expense_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Amount (Rs.) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quickAddForm.amount}
                    onChange={(e) => setQuickAddForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={quickAddForm.description}
                  onChange={(e) => setQuickAddForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g., Clinic Rent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category *</Label>
                  <Select
                    value={quickAddForm.category_id}
                    onValueChange={(v) => {
                      setQuickAddForm((p) => ({ ...p, category_id: v, is_recurring: p.expense_type === 'recurring' }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={quickAddForm.payment_method} onValueChange={(v) => setQuickAddForm((p) => ({ ...p, payment_method: v as PaymentMethod }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="mobile_wallet">Mobile Wallet</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Vendor</Label>
                <Input
                  value={quickAddForm.vendor_name}
                  onChange={(e) => setQuickAddForm((p) => ({ ...p, vendor_name: e.target.value }))}
                  placeholder="e.g., ABC Company"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={quickAddForm.notes}
                  onChange={(e) => setQuickAddForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
              
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" type="button" onClick={() => setIsQuickAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!quickAddForm.expense_date || quickAddForm.category_id === 'none' || !Number.isFinite(Number(quickAddForm.amount))}
              >
                Add Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Recurring Template</DialogTitle>
            <DialogDescription>Create a reusable template for monthly recurring expenses.</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveTemplate();
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Next Due Date *</Label>
                <Input
                  type="date"
                  value={templateForm.next_due_date}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, next_due_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Default Amount *</Label>
                <Input
                  type="number"
                  value={templateForm.amount}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Input
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Electricity"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Category *</Label>
                <Select value={templateForm.category_id} onValueChange={(v) => setTemplateForm((p) => ({ ...p, category_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={templateForm.payment_method} onValueChange={(v) => setTemplateForm((p) => ({ ...p, payment_method: v as PaymentMethod }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vendor</Label>
                <Input
                  value={templateForm.vendor_name}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, vendor_name: e.target.value }))}
                  placeholder="e.g. K-Electric"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={templateForm.notes}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => setIsTemplateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!templateForm.next_due_date || templateForm.category_id === 'none' || !Number.isFinite(Number(templateForm.amount))}
              >
                Save Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCategoryId} onOpenChange={(open) => !open && setDeleteCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Expenses in this category will keep their records but the category will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteCategoryId) return;
                const id = deleteCategoryId;
                setDeleteCategoryId(null);
                await deleteCategory(id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
