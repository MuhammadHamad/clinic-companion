import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { 
  Plus, 
  Search, 
  Eye,
  Pencil,
  Phone, 
  Mail,
  Calendar,
  DollarSign,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Archive,
  ArchiveRestore,
  ArchiveX,
  RotateCcw,
} from 'lucide-react';
import {
  PatientStatsCards,
  PatientFormDialog,
  PaymentDialog,
  PatientsTable,
  ArchivePatientDialog,
  RestorePatientDialog,
  DuplicatePatientDialog,
  type PatientFormData as PatientFormDialogData,
  type PaymentFormData,
} from '@/components/patients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Textarea } from '@/components/ui/textarea';
import { usePatients, useInvoices, useTreatmentTypes } from '@/hooks';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, Patient, Payment, PaymentMethod, InvoiceItem, TreatmentType } from '@/types';
import { useToast } from '@/hooks';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { patientSchema, invoiceSchema, type PatientFormData } from '@/lib/validation';
import { InvoiceViewDialog } from '@/components/invoices/InvoiceViewDialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type DraftInvoiceItem = Omit<InvoiceItem, 'id' | 'invoice_id'>;

const INVOICE_CREATE_DRAFT_STORAGE_KEY = 'cc_invoice_create_patients_v1';
const INVOICE_VIEW_STORAGE_KEY = 'cc_invoice_view_patients_v1';
const STATEMENT_VIEW_STORAGE_KEY = 'cc_statement_view_patients_v1';

function readInvoiceCreateDraft(): {
  open: boolean;
  patientId: string | null;
  form: {
    items: DraftInvoiceItem[];
    discount_amount: number;
    tax_amount: number;
    payment_terms: string;
    notes: string;
  };
} | null {
  try {
    const raw = sessionStorage.getItem(INVOICE_CREATE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.open !== true) return null;
    return {
      open: true,
      patientId: typeof parsed.patientId === 'string' ? parsed.patientId : null,
      form: {
        items: Array.isArray(parsed.form?.items) ? (parsed.form.items as DraftInvoiceItem[]) : [],
        discount_amount: Number(parsed.form?.discount_amount || 0),
        tax_amount: Number(parsed.form?.tax_amount || 0),
        payment_terms: typeof parsed.form?.payment_terms === 'string' ? parsed.form.payment_terms : '',
        notes: typeof parsed.form?.notes === 'string' ? parsed.form.notes : '',
      },
    };
  } catch {
    return null;
  }
}

function readStatementViewDraft(): { patientId: string | null; pathname: string | null } | null {
  try {
    const raw = sessionStorage.getItem(STATEMENT_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      patientId: typeof parsed.patientId === 'string' ? parsed.patientId : null,
      pathname: typeof parsed.pathname === 'string' ? parsed.pathname : null,
    };
  } catch {
    return null;
  }
}

function readInvoiceViewDraft(): { invoiceId: string | null; pathname: string | null } | null {
  try {
    const raw = sessionStorage.getItem(INVOICE_VIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      invoiceId: typeof parsed.invoiceId === 'string' ? parsed.invoiceId : null,
      pathname: typeof parsed.pathname === 'string' ? parsed.pathname : null,
    };
  } catch {
    return null;
  }
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  unpaid: 'bg-financial-unpaid/10 text-financial-unpaid border-financial-unpaid/20',
  partial: 'bg-financial-partial/10 text-financial-partial border-financial-partial/20',
  paid: 'bg-financial-paid/10 text-financial-paid border-financial-paid/20',
  overdue: 'bg-financial-overdue/10 text-financial-overdue border-financial-overdue/20',
};

export default function Patients() {
  const {
    pagedPatients,
    pagedTotalCount,
    isPageLoading,
    fetchPatientsPage,
    createPatient,
    updatePatient,
    archivePatient,
    restorePatient,
  } = usePatients({ autoFetch: false });
  const {
    recordPayment,
    updateInvoiceDiscount,
    createInvoice,
    fetchInvoiceSummariesByPatientIds,
    fetchInvoicesForPatient,
    fetchInvoiceById,
  } = useInvoices({ autoFetch: false });
  const { treatmentTypes, createTreatmentType, updateTreatmentType, deleteTreatmentType } = useTreatmentTypes();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicatePatientWarningForPhone, setDuplicatePatientWarningForPhone] = useState<string | null>(null);
  const { toast } = useToast();

  // Services (Treatment Types) management state
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false);
  const [serviceFormMode, setServiceFormMode] = useState<'create' | 'edit'>('create');
  const [selectedService, setSelectedService] = useState<TreatmentType | null>(null);
  const [serviceFormData, setServiceFormData] = useState({
    name: '',
    code: '',
    default_price: 0,
    duration_minutes: 30,
    category: '',
    is_active: true,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [hasLoadedPageOnce, setHasLoadedPageOnce] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [patientPayments, setPatientPayments] = useState<Payment[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: '' as PaymentMethod | '',
    reference_number: '',
    notes: '',
  });

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicatePatientInfo, setDuplicatePatientInfo] = useState<Patient | null>(null);

  const [patientsStats, setPatientsStats] = useState({
    total: 0,
    active: 0,
    newThisMonth: 0,
  });

  const refreshPatientsStats = useCallback(async () => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const startIso = start.toISOString();
      const nextIso = next.toISOString();

      const [totalRes, activeRes, newRes] = await Promise.all([
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'archived')
          .neq('status', 'lead'),
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startIso)
          .lt('created_at', nextIso)
          .neq('status', 'archived')
          .neq('status', 'lead'),
      ]);

      setPatientsStats({
        total: totalRes.count || 0,
        active: activeRes.count || 0,
        newThisMonth: newRes.count || 0,
      });
    } catch (e) {
      logger.error('Error fetching patient stats:', e);
    }
  }, []);

  const [isInvoiceViewOpen, setIsInvoiceViewOpen] = useState(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);

  useEffect(() => {
    const draft = readInvoiceViewDraft();
    if (!draft?.invoiceId) return;
    if (draft.pathname && draft.pathname !== location.pathname) return;
    if (isInvoiceViewOpen) return;

    (async () => {
      const res = await fetchInvoiceById(draft.invoiceId as string);
      if (!res.success) return;
      setSelectedInvoiceForView(res.data);
      setIsInvoiceViewOpen(true);
    })();
  }, [fetchInvoiceById, isInvoiceViewOpen, location.pathname]);

  const [invoiceSummariesByPatientId, setInvoiceSummariesByPatientId] = useState<
    Record<string, { balance: number; lastVisit: string | null }>
  >({});
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [selectedPatientInvoices, setSelectedPatientInvoices] = useState<Invoice[]>([]);
  const [isLoadingSelectedPatientInvoices, setIsLoadingSelectedPatientInvoices] = useState(false);

  const [isInvoiceCreateOpen, setIsInvoiceCreateOpen] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [invoiceFormData, setInvoiceFormData] = useState(() => {
    const draft = readInvoiceCreateDraft();
    const base = {
      items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }] as DraftInvoiceItem[],
      discount_amount: 0,
      tax_amount: 0,
      payment_terms: '',
      notes: '',
    };

    if (!draft) return base;
    const safeItems = (draft.form.items || []).filter(Boolean);
    return {
      items: safeItems.length ? safeItems : base.items,
      discount_amount: Number(draft.form.discount_amount || 0),
      tax_amount: Number(draft.form.tax_amount || 0),
      payment_terms: draft.form.payment_terms || '',
      notes: draft.form.notes || '',
    };
  });

  useEffect(() => {
    const draft = readInvoiceCreateDraft();
    if (!draft) return;
    setIsInvoiceCreateOpen(true);
    if (draft.patientId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('patients')
            .select('*')
            .eq('id', draft.patientId)
            .single();
          if (error) throw error;
          if (!data) return;
          setSelectedPatient({
            id: data.id,
            patient_number: data.patient_number,
            first_name: data.first_name,
            last_name: data.last_name,
            date_of_birth: data.date_of_birth || undefined,
            gender: data.gender || undefined,
            phone: data.phone,
            email: data.email || undefined,
            address: data.address || undefined,
            city: data.city || undefined,
            emergency_contact_name: data.emergency_contact_name || undefined,
            emergency_contact_phone: data.emergency_contact_phone || undefined,
            allergies: data.allergies || undefined,
            current_medications: data.current_medications || undefined,
            medical_conditions: data.medical_conditions || undefined,
            registration_date: data.registration_date,
            last_visit_date: data.last_visit_date || undefined,
            notes: data.notes || undefined,
            status: data.status,
            created_at: data.created_at,
            created_by: data.created_by || undefined,
            balance: data.balance != null ? Number(data.balance) : undefined,
            archived_at: data.archived_at || undefined,
          } as Patient);
        } catch (e) {
          logger.error('Error restoring invoice draft patient:', e);
        }
      })();
    }
  }, []);

  useEffect(() => {
    try {
      if (!isInvoiceCreateOpen) {
        sessionStorage.removeItem(INVOICE_CREATE_DRAFT_STORAGE_KEY);
        return;
      }

      sessionStorage.setItem(
        INVOICE_CREATE_DRAFT_STORAGE_KEY,
        JSON.stringify({
          open: true,
          patientId: selectedPatient?.id || null,
          form: invoiceFormData,
          updatedAt: Date.now(),
        }),
      );
    } catch {
      // ignore
    }
  }, [invoiceFormData, isInvoiceCreateOpen, selectedPatient?.id]);

  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [patientToRestore, setPatientToRestore] = useState<Patient | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const openStatementDialog = useCallback(() => {
    if (!selectedPatient?.id) {
      setIsStatementOpen(true);
      return;
    }

    setIsStatementOpen(true);
    try {
      sessionStorage.setItem(
        STATEMENT_VIEW_STORAGE_KEY,
        JSON.stringify({ patientId: selectedPatient.id, pathname: location.pathname, updatedAt: Date.now() }),
      );
    } catch {
      // ignore
    }
  }, [location.pathname, selectedPatient?.id]);

  useEffect(() => {
    const draft = readStatementViewDraft();
    if (!draft?.patientId) return;
    if (draft.pathname && draft.pathname !== location.pathname) return;
    if (isStatementOpen) return;

    (async () => {
      try {
        if (!selectedPatient || selectedPatient.id !== draft.patientId) {
          const { data, error } = await supabase
            .from('patients')
            .select('*')
            .eq('id', draft.patientId)
            .single();

          if (error) throw error;
          if (!data) return;

          setSelectedPatient({
            id: data.id,
            patient_number: data.patient_number,
            first_name: data.first_name,
            last_name: data.last_name,
            date_of_birth: data.date_of_birth || undefined,
            gender: data.gender || undefined,
            phone: data.phone,
            email: data.email || undefined,
            address: data.address || undefined,
            city: data.city || undefined,
            emergency_contact_name: data.emergency_contact_name || undefined,
            emergency_contact_phone: data.emergency_contact_phone || undefined,
            allergies: data.allergies || undefined,
            current_medications: data.current_medications || undefined,
            medical_conditions: data.medical_conditions || undefined,
            registration_date: data.registration_date,
            last_visit_date: data.last_visit_date || undefined,
            notes: data.notes || undefined,
            status: data.status,
            created_at: data.created_at,
            created_by: data.created_by || undefined,
            balance: data.balance != null ? Number(data.balance) : undefined,
            archived_at: data.archived_at || undefined,
          } as Patient);
        }

        setIsStatementOpen(true);
      } catch (e) {
        logger.error('Error restoring statement modal:', e);
      }
    })();
  }, [isStatementOpen, location.pathname, selectedPatient, setSelectedPatient]);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: '',
    address: '',
    city: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    allergies: '',
    current_medications: '',
    medical_conditions: '',
    notes: '',
  });

  const currentPagePatients = pagedPatients;

  const refreshCurrentPageInvoiceSummaries = useCallback(async () => {
    const ids = currentPagePatients.map((p) => p.id);
    const res = await fetchInvoiceSummariesByPatientIds(ids);
    if (!res.success) return;
    setInvoiceSummariesByPatientId(res.data);
  }, [currentPagePatients, fetchInvoiceSummariesByPatientIds]);

  const normalizeSearchQuery = useCallback((value: string) => {
    return value.replace(/\s+/g, ' ').trim();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q') ?? '';
    setSearchInput((prev) => {
      if (prev !== q) {
        setCurrentPage(1);
      }
      return prev === q ? prev : q;
    });
    setSearchQuery((prev) => (prev === q ? prev : q));
  }, [location.search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = normalizeSearchQuery(searchInput);
      setSearchQuery((prev) => {
        if (prev === next) return prev;
        setCurrentPage(1);
        return next;
      });
    }, 300);

    return () => {
      window.clearTimeout(handle);
    };
  }, [normalizeSearchQuery, searchInput]);

  useEffect(() => {
    fetchPatientsPage({
      page: currentPage,
      pageSize,
      searchQuery,
      statusFilter,
    });
  }, [fetchPatientsPage, currentPage, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    if (!isPageLoading) {
      setHasLoadedPageOnce(true);
    }
  }, [isPageLoading]);

  useEffect(() => {
    refreshPatientsStats();
  }, [refreshPatientsStats]);

  const refreshOutstandingTotal = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('balance')
        .neq('status', 'archived');

      if (error) throw error;

      const sum = (data || []).reduce((acc: number, row: any) => acc + Number(row.balance || 0), 0);
      setTotalOutstanding(sum);
    } catch (e) {
      logger.error('Error fetching outstanding total:', e);
    }
  }, []);

  useEffect(() => {
    refreshOutstandingTotal();
  }, [refreshOutstandingTotal]);

  useEffect(() => {
    refreshCurrentPageInvoiceSummaries();
  }, [refreshCurrentPageInvoiceSummaries]);

  // Pagination calculations (server-side)
  const totalPatients = pagedTotalCount;
  const totalPages = Math.max(1, Math.ceil(totalPatients / pageSize));
  const startIndex = totalPatients === 0 ? -1 : (currentPage - 1) * pageSize;
  const endIndex =
    totalPatients === 0
      ? 0
      : Math.min(startIndex + currentPagePatients.length, totalPatients);

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return '-';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const openCreateForm = () => {
    setFormMode('create');
    setEditingPatientId(null);
    setFormData({
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      date_of_birth: '',
      gender: '',
      address: '',
      city: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      allergies: '',
      current_medications: '',
      medical_conditions: '',
      notes: '',
    });
    setDuplicatePatientWarningForPhone(null);
    setIsFormOpen(true);
  };

  const openEditForm = (patient: Patient) => {
    setFormMode('edit');
    setEditingPatientId(patient.id);
    setSelectedPatient(patient);
    const newFormData = {
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone: patient.phone,
      email: patient.email || '',
      date_of_birth: patient.date_of_birth || '',
      gender: patient.gender || '',
      address: patient.address || '',
      city: patient.city || '',
      emergency_contact_name: patient.emergency_contact_name || '',
      emergency_contact_phone: patient.emergency_contact_phone || '',
      allergies: patient.allergies || '',
      current_medications: patient.current_medications || '',
      medical_conditions: patient.medical_conditions || '',
      notes: patient.notes || '',
    };
    setFormData(newFormData);
    setDuplicatePatientWarningForPhone(null);
    setIsFormOpen(true);
  };

  const openViewDialog = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsViewOpen(true);

    const params = new URLSearchParams(location.search);
    params.set('viewPatientId', patient.id);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false });
  };

  const closeViewDialog = () => {
    setIsViewOpen(false);
    setSelectedPatientInvoices([]);
    setIsLoadingSelectedPatientInvoices(false);

    const params = new URLSearchParams(location.search);
    params.delete('viewPatientId');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false });
  };

  const refreshSelectedPatientInvoices = useCallback(
    async (patientId: string, silent = false) => {
      if (!silent) setIsLoadingSelectedPatientInvoices(true);
      const res = await fetchInvoicesForPatient(patientId);
      if (res.success) {
        setSelectedPatientInvoices(res.data);
      }
      if (!silent) setIsLoadingSelectedPatientInvoices(false);
    },
    [fetchInvoicesForPatient],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewPatientId = params.get('viewPatientId');

    if (!viewPatientId) {
      if (isViewOpen) setIsViewOpen(false);
      // Don't clear the patient while editing, otherwise edit submit loses the ID.
      if (!editingPatientId && selectedPatient) setSelectedPatient(null);
      return;
    }

    const inPage = currentPagePatients.find((p) => p.id === viewPatientId);
    if (!inPage) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('patients')
            .select('*')
            .eq('id', viewPatientId)
            .single();

          if (error) throw error;
          if (!data) return;

          const mapped = {
            id: data.id,
            patient_number: data.patient_number,
            first_name: data.first_name,
            last_name: data.last_name,
            date_of_birth: data.date_of_birth || undefined,
            gender: data.gender || undefined,
            phone: data.phone,
            email: data.email || undefined,
            address: data.address || undefined,
            city: data.city || undefined,
            emergency_contact_name: data.emergency_contact_name || undefined,
            emergency_contact_phone: data.emergency_contact_phone || undefined,
            allergies: data.allergies || undefined,
            current_medications: data.current_medications || undefined,
            medical_conditions: data.medical_conditions || undefined,
            registration_date: data.registration_date,
            last_visit_date: data.last_visit_date || undefined,
            notes: data.notes || undefined,
            status: data.status,
            created_at: data.created_at,
            created_by: data.created_by || undefined,
            balance: data.balance != null ? Number(data.balance) : undefined,
            archived_at: data.archived_at || undefined,
          } as Patient;

          if (!selectedPatient || selectedPatient.id !== mapped.id) {
            setSelectedPatient(mapped);
          }
          if (!isViewOpen) setIsViewOpen(true);
        } catch (e) {
          logger.error('Error fetching patient for view:', e);
        }
      })();
      return;
    }

    if (!selectedPatient || selectedPatient.id !== inPage.id) {
      setSelectedPatient(inPage);
    }
    if (!isViewOpen) {
      setIsViewOpen(true);
    }
  }, [location.search, currentPagePatients, isViewOpen, selectedPatient]);

  const loadPatientPayments = async (patientId: string, silent = false) => {
    try {
      if (!silent) setIsLoadingPayments(true);
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('patient_id', patientId)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const mapped: Payment[] = (data || []).map((p: any) => ({
        id: p.id,
        invoice_id: p.invoice_id,
        patient_id: p.patient_id,
        payment_date: p.payment_date,
        amount: Number(p.amount) || 0,
        payment_method: p.payment_method as PaymentMethod,
        reference_number: p.reference_number || undefined,
        notes: p.notes || undefined,
        created_at: p.created_at,
      }));

      setPatientPayments(mapped);
    } catch (err) {
      logger.error('Error fetching patient payments:', err);
    } finally {
      if (!silent) setIsLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (!isViewOpen || !selectedPatient) return;
    loadPatientPayments(selectedPatient.id);
  }, [isViewOpen, selectedPatient?.id]);

  useEffect(() => {
    if (!selectedPatient) return;
    if (!isViewOpen && !isStatementOpen) return;
    refreshSelectedPatientInvoices(selectedPatient.id);
  }, [isViewOpen, isStatementOpen, selectedPatient?.id, refreshSelectedPatientInvoices]);

  useEffect(() => {
    const cleanup = () => {
      document.body.classList.remove('printing-statement');
      document.body.classList.remove('statement-open');
    };

    window.addEventListener('afterprint', cleanup);
    return () => {
      window.removeEventListener('afterprint', cleanup);
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!isStatementOpen) {
      document.body.classList.remove('statement-open');
      return;
    }

    document.body.classList.add('statement-open');
    return () => {
      document.body.classList.remove('statement-open');
    };
  }, [isStatementOpen]);

  const handlePrintStatement = () => {
    document.body.classList.add('printing-statement');
    window.print();
  };

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentData({
      amount: invoice.balance,
      payment_method: '',
      reference_number: '',
      notes: '',
    });
    setIsPaymentOpen(true);
  };

  const openInvoiceViewDialog = (invoice: Invoice) => {
    setSelectedInvoiceForView(invoice);
    setIsInvoiceViewOpen(true);
    try {
      sessionStorage.setItem(
        INVOICE_VIEW_STORAGE_KEY,
        JSON.stringify({ invoiceId: invoice.id, pathname: location.pathname, updatedAt: Date.now() }),
      );
    } catch {
      // ignore
    }
  };

  const openCreateInvoiceDialog = (patient: Patient) => {
    setSelectedPatient(patient);
    setInvoiceFormData({
      items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }] as DraftInvoiceItem[],
      discount_amount: 0,
      tax_amount: 0,
      payment_terms: '',
      notes: '',
    });
    setIsInvoiceCreateOpen(true);
  };

  const addInvoiceItem = () => {
    setInvoiceFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0, total: 0 }],
    }));
  };

  const updateInvoiceItem = (index: number, field: keyof DraftInvoiceItem, value: string | number) => {
    setInvoiceFormData((prev) => {
      const next = [...prev.items];
      (next[index] as any)[field] = value;
      if (field === 'quantity' || field === 'unit_price') {
        const qty = Number(next[index].quantity || 0);
        const price = Number(next[index].unit_price || 0);
        next[index].total = qty * price;
      }
      return { ...prev, items: next };
    });
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceFormData((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  };

  const calculateInvoiceTotals = () => {
    const subtotal = invoiceFormData.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const total = subtotal - Number(invoiceFormData.discount_amount || 0) + Number(invoiceFormData.tax_amount || 0);
    return { subtotal, total };
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (isCreatingInvoice) return;

    const payload = {
      patient_id: selectedPatient.id,
      items: invoiceFormData.items,
      discount_amount: Number(invoiceFormData.discount_amount || 0),
      tax_amount: Number(invoiceFormData.tax_amount || 0),
      payment_terms: invoiceFormData.payment_terms,
      notes: invoiceFormData.notes,
    };

    const validationResult = invoiceSchema.safeParse(payload);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map((err) => err.message).join('. ');
      toast({ title: 'Validation Error', description: errorMessages, variant: 'destructive' });
      return;
    }

    setIsCreatingInvoice(true);
    try {
      const { total } = calculateInvoiceTotals();
      const result = await createInvoice({
        patient_id: selectedPatient.id,
        items: invoiceFormData.items.filter((i) => i.description),
        discount_amount: Number(invoiceFormData.discount_amount || 0),
        tax_amount: Number(invoiceFormData.tax_amount || 0),
        payment_terms: invoiceFormData.payment_terms,
        notes: invoiceFormData.notes,
      });

      if (result.success) {
        toast({ title: 'Invoice Created', description: `Invoice created for Rs. ${total.toLocaleString()}` });
        setIsInvoiceCreateOpen(false);
        try {
          sessionStorage.removeItem(INVOICE_CREATE_DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }
        await refreshOutstandingTotal();
        await refreshCurrentPageInvoiceSummaries();
        if (selectedPatient) {
          await refreshSelectedPatientInvoices(selectedPatient.id);
        }
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.refetchQueries({ queryKey: ['dashboard'], type: 'active' });
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to create invoice', variant: 'destructive' });
      }
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleInvoiceDiscountUpdate = async (invoice: Invoice, discountAmount: number) => {
    const result = await updateInvoiceDiscount(invoice.id, discountAmount);
    if (result.success) {
      toast({
        title: 'Invoice Updated',
        description: 'Discount has been updated successfully',
      });
      setSelectedInvoiceForView((prev) =>
        prev && prev.id === invoice.id ? { ...prev, discount_amount: discountAmount } : prev,
      );
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update invoice',
        variant: 'destructive',
      });
    }
  };

  const handlePatientPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment || !selectedPatient) return;

    if (!paymentData.payment_method || paymentData.amount <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select a payment method and enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    const result = await recordPayment(selectedInvoiceForPayment.id, {
      amount: paymentData.amount,
      payment_method: paymentData.payment_method as PaymentMethod,
      reference_number: paymentData.reference_number || undefined,
      notes: paymentData.notes || undefined,
    });

    if (result.success) {
      setIsPaymentOpen(false);
      setSelectedInvoiceForPayment(null);
      toast({
        title: 'Payment Updated',
        description: 'Payment has been updated successfully',
      });
      await loadPatientPayments(selectedPatient.id, true);
      await refreshOutstandingTotal();
      await refreshCurrentPageInvoiceSummaries();
      await refreshSelectedPatientInvoices(selectedPatient.id, true);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update payment',
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (patient: Patient) => {
    setPatientToDelete(patient);
    setIsDeleteOpen(true);
  };

  const confirmArchivePatient = async () => {
    if (!patientToDelete) return;
    setIsDeleting(true);

    const result = await archivePatient(patientToDelete.id);

    if (result.success) {
      toast({
        title: 'Patient Archived',
        description: 'The patient record has been archived successfully.',
      });
      fetchPatientsPage({ page: currentPage, pageSize, searchQuery, statusFilter });
      refreshPatientsStats();
      setIsDeleteOpen(false);
      setPatientToDelete(null);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to archive patient',
        variant: 'destructive',
      });
    }

    setIsDeleting(false);
  };

  const handleRestorePatient = async (patient: Patient) => {
    setPatientToRestore(patient);
    setIsRestoreOpen(true);
  };

  const confirmRestorePatient = async () => {
    if (!patientToRestore) return;
    setIsRestoring(true);

    const result = await restorePatient(patientToRestore.id);
    
    if (result.success) {
      toast({
        title: 'Patient Restored',
        description: 'The patient has been restored to active status.',
      });
      fetchPatientsPage({ page: currentPage, pageSize, searchQuery, statusFilter });
      refreshPatientsStats();
      setIsRestoreOpen(false);
      setPatientToRestore(null);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to restore patient',
        variant: 'destructive',
      });
    }

    setIsRestoring(false);
  };

  const createPatientFromForm = async () => {
    const result = await createPatient({
      ...formData,
      gender: formData.gender as 'male' | 'female' | 'other' | undefined,
      status: 'active',
      balance: 0,
    });

    if (result.success) {
      toast({
        title: 'Patient Created',
        description: `${formData.first_name} ${formData.last_name} has been registered successfully`,
      });
      fetchPatientsPage({ page: 1, pageSize, searchQuery, statusFilter });
      refreshPatientsStats();
      setCurrentPage(1);
      setIsFormOpen(false);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create patient',
        variant: 'destructive',
      });
    }

    return result;
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateModalOpen(false);
    setDuplicatePatientInfo(null);
    setDuplicatePatientWarningForPhone(null);
    setIsSubmitting(true);
    
    const result = await createPatientFromForm();
    
    if (result.success) {
      toast({
        title: 'Patient Created',
        description: `${formData.first_name} ${formData.last_name} has been registered successfully`,
      });
      setIsFormOpen(false);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create patient',
        variant: 'destructive',
      });
    }
    
    setIsSubmitting(false);
  };

  const handleDuplicateCancel = () => {
    setDuplicateModalOpen(false);
    setDuplicatePatientInfo(null);
    setDuplicatePatientWarningForPhone(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data with Zod
      const validationResult = patientSchema.safeParse(formData);
      if (!validationResult.success) {
        const errorMessages = validationResult.error.errors.map(err => err.message).join('. ');
        toast({
          title: 'Validation Error',
          description: errorMessages,
          variant: 'destructive',
        });
        return;
      }

      if (formMode === 'create') {
        const normalizedPhone = formData.phone.trim();
        if (normalizedPhone && duplicatePatientWarningForPhone !== normalizedPhone) {
          try {
            const { data: existing, error } = await supabase
              .from('patients')
              .select('*')
              .eq('phone', normalizedPhone)
              .neq('status', 'archived')
              .limit(1)
              .maybeSingle();

            if (error) throw error;
            if (existing) {
              const mapped = {
                id: existing.id,
                patient_number: existing.patient_number,
                first_name: existing.first_name,
                last_name: existing.last_name,
                date_of_birth: existing.date_of_birth || undefined,
                gender: existing.gender || undefined,
                phone: existing.phone,
                email: existing.email || undefined,
                address: existing.address || undefined,
                city: existing.city || undefined,
                emergency_contact_name: existing.emergency_contact_name || undefined,
                emergency_contact_phone: existing.emergency_contact_phone || undefined,
                allergies: existing.allergies || undefined,
                current_medications: existing.current_medications || undefined,
                medical_conditions: existing.medical_conditions || undefined,
                registration_date: existing.registration_date,
                last_visit_date: existing.last_visit_date || undefined,
                notes: existing.notes || undefined,
                status: existing.status,
                created_at: existing.created_at,
                created_by: existing.created_by || undefined,
                balance: existing.balance != null ? Number(existing.balance) : undefined,
                archived_at: existing.archived_at || undefined,
              } as Patient;

              setDuplicatePatientWarningForPhone(normalizedPhone);
              setDuplicatePatientInfo(mapped);
              setDuplicateModalOpen(true);
              return;
            }
          } catch (err) {
            logger.error('Error checking duplicate patient phone:', err);
          }
        }
      }

      setIsSubmitting(true);

      if (formMode === 'create') {
        await createPatientFromForm();
      } else {
        const patientIdToUpdate = editingPatientId || selectedPatient?.id;
        if (!patientIdToUpdate) {
          toast({
            title: 'Error',
            description: 'No customer selected to update',
            variant: 'destructive',
          });
          return;
        }

        const result = await updatePatient(patientIdToUpdate, {
          ...formData,
          gender: formData.gender as 'male' | 'female' | 'other' | undefined,
        });

        if (result.success) {
          toast({
            title: 'Patient Updated',
            description: 'Patient information has been updated successfully',
          });
          if (result.data) {
            setSelectedPatient((prev) => (prev && prev.id === result.data!.id ? result.data! : prev));
          }
          fetchPatientsPage({ page: currentPage, pageSize, searchQuery, statusFilter });
          setIsFormOpen(false);
          setEditingPatientId(null);
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Failed to update patient',
            variant: 'destructive',
          });
        }
      }
    } catch (err: any) {
      logger.error('Error submitting patient form:', err);
      toast({
        title: 'Error',
        description: err?.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasLoadedPageOnce && isPageLoading && currentPagePatients.length === 0) {
    return (
      <div className="min-h-screen">
        <Header title="Customers" subtitle="Manage your customer records" />
        <div className="p-6 space-y-6">
          <div className="flex gap-4 justify-between">
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="bg-card rounded-xl border border-border p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <Header title="Customers" subtitle="Manage your customer records" />
      
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
        <PatientStatsCards
          total={patientsStats.total}
          active={patientsStats.active}
          newThisMonth={patientsStats.newThisMonth}
          totalOutstanding={totalOutstanding}
        />

        {/* Actions Bar */}
        <div className="patients-actions-bar flex flex-col gap-4">
          <div className="patients-actions-row flex flex-col sm:flex-row gap-3">
            <div className="patients-search relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or customer #..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="patients-status-trigger w-full sm:w-36">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreateForm} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>

        <style>{`
          @media (hover: hover) and (pointer: fine) {
            .patients-actions-bar {
              flex-direction: row;
              align-items: center;
            }
            .patients-actions-row {
              flex: 1;
              flex-direction: row;
              align-items: center;
            }
            .patients-search {
              flex: 0 1 36rem;
              max-width: 36rem;
            }
            .patients-status-trigger {
              width: 9rem;
            }
            .patients-actions-bar > button {
              width: auto !important;
              white-space: nowrap;
            }
          }
        `}</style>

        {/* Patients Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-nowrap">Customer #</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Name</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Age</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Phone</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Last Visit</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Balance</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {currentPagePatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {totalPatients === 0 ? 'No customers found' : 'No customers on this page'}
                  </TableCell>
                </TableRow>
              ) : (
                currentPagePatients.map((patient) => {
                  const summary = invoiceSummariesByPatientId[patient.id];
                  const lastVisit = summary?.lastVisit || patient.last_visit_date || '-';
                  const balance = summary ? summary.balance : (patient.balance || 0);

                  return (
                    <TableRow key={patient.id} className="data-table-row">
                      <TableCell className="font-medium text-primary">{patient.patient_number}</TableCell>
                      <TableCell>
                        <button 
                          onClick={() => openViewDialog(patient)}
                          className="font-medium text-primary hover:underline text-left"
                        >
                          {patient.first_name} {patient.last_name}
                        </button>
                        {patient.email && (
                          <div className="text-sm text-muted-foreground">{patient.email}</div>
                        )}
                      </TableCell>
                      <TableCell>{calculateAge(patient.date_of_birth)}</TableCell>
                      <TableCell>{patient.phone}</TableCell>
                      <TableCell>{lastVisit}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'font-medium',
                            balance > 0 ? 'text-destructive' : 'text-foreground',
                          )}
                        >
                          Rs. {balance.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            patient.status === 'active' ? 'default' : 
                            patient.status === 'archived' ? 'destructive' : 'secondary'
                          }
                        >
                          {patient.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openViewDialog(patient)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditForm(patient)}
                                disabled={patient.status === 'archived'}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit</p>
                            </TooltipContent>
                          </Tooltip>
                          {patient.status === 'archived' ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRestorePatient(patient)}
                                >
                                  <ArchiveRestore className="h-4 w-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Restore</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDeleteDialog(patient)}
                                >
                                  <ArchiveX className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Archive</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPatients > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalPatients}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Create/Edit Patient Dialog */}
      <PatientFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingPatientId(null);
          }
        }}
        mode={formMode}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        duplicateWarning={duplicatePatientWarningForPhone}
        selectedPatient={selectedPatient}
      />

      {/* Patient Statement (Ledger) Dialog */}
      <Dialog
        open={isStatementOpen}
        onOpenChange={(open) => {
          setIsStatementOpen(open);
          if (!open) {
            try {
              sessionStorage.removeItem(STATEMENT_VIEW_STORAGE_KEY);
            } catch {
              // ignore
            }
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto pr-2 patient-statement-print !bg-white !text-slate-900 !border-0">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-900">Customer Statement</DialogTitle>
            <DialogDescription className="text-slate-600">
              {selectedPatient
                ? `Financial history for ${selectedPatient.first_name} ${selectedPatient.last_name}`
                : 'Customer financial history'}
            </DialogDescription>
          </DialogHeader>

          {selectedPatient && (() => {
            if (isLoadingSelectedPatientInvoices) {
              return (
                <div className="rounded-lg border p-6 text-center text-muted-foreground">Loading statement...</div>
              );
            }

            const patientInvoices = selectedPatientInvoices;
            const invoiceNumberById = new Map(patientInvoices.map((inv) => [inv.id, inv.invoice_number] as const));

            type LedgerEntry = {
              id: string;
              type: 'invoice' | 'payment';
              date: string;
              sortKey: string;
              reference: string;
              description: string;
              debit: number; // charges
              credit: number; // payments
            };

            const entries: LedgerEntry[] = [
              ...patientInvoices.map((inv) => ({
                id: `inv-${inv.id}`,
                type: 'invoice' as const,
                date: inv.invoice_date || inv.created_at,
                sortKey: (inv.invoice_date || inv.created_at || ''),
                reference: inv.invoice_number,
                description: inv.notes || 'Treatment invoice',
                debit: inv.total_amount,
                credit: 0,
              })),
              ...patientPayments.map((p) => ({
                id: `pay-${p.id}`,
                type: 'payment' as const,
                date: p.payment_date || p.created_at,
                sortKey: (p.payment_date || p.created_at || ''),
                reference: invoiceNumberById.get(p.invoice_id) || '-',
                description: p.notes || 'Payment received',
                debit: 0,
                credit: p.amount,
              })),
            ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

            const formatDate = (value: string) => {
              if (!value) return '-';
              const d = new Date(value);
              if (Number.isNaN(d.getTime())) return value;
              return d.toLocaleDateString('en-GB');
            };

            let running = 0;
            const rows = entries.map((e) => {
              running += e.debit - e.credit;
              return { ...e, balance: running };
            });

            const totalDebits = rows.reduce((sum, r) => sum + r.debit, 0);
            const totalCredits = rows.reduce((sum, r) => sum + r.credit, 0);
            const outstanding = totalDebits - totalCredits;

            return (
              <div className="space-y-4 mt-2 text-sm">
                <div className="p-4 rounded-lg border bg-white text-slate-900 shadow-sm patient-statement-card">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-medium text-slate-600">Customer</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">Customer ID:</span> {selectedPatient.patient_number || '-'}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">Phone:</span> {selectedPatient.phone || '-'}
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="font-medium text-slate-700">Email:</span> {selectedPatient.email || '-'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-slate-600">Statement Date</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {new Date().toLocaleDateString('en-GB')}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">Currency:</span> PKR (Rs.)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-lg border bg-white text-slate-900 shadow-sm patient-statement-card">
                    <div className="text-xs font-medium text-slate-600">Total Debits (Invoices)</div>
                    <div className="text-xl font-semibold text-slate-900">
                      Rs. {totalDebits.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-white text-slate-900 shadow-sm patient-statement-card">
                    <div className="text-xs font-medium text-slate-600">Total Credits (Payments)</div>
                    <div className="text-xl font-semibold text-slate-900">
                      Rs. {totalCredits.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg border bg-white text-slate-900 shadow-sm patient-statement-card">
                    <div className="text-xs font-medium text-slate-600">Outstanding Balance</div>
                    <div
                      className={cn(
                        'text-xl font-semibold',
                        outstanding > 0 ? 'text-destructive' : 'text-slate-900'
                      )}
                    >
                      Rs. {outstanding.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border overflow-hidden bg-white shadow-sm patient-statement-table-wrapper">
                  <Table className="patient-statement-table text-sm table-fixed">
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold text-slate-700 w-[100px]">Date</TableHead>
                        <TableHead className="font-semibold text-slate-700 w-[90px]">Reference</TableHead>
                        <TableHead className="font-semibold text-slate-700">Description</TableHead>
                        <TableHead className="text-right w-[110px] font-semibold text-slate-700">Debit</TableHead>
                        <TableHead className="text-right w-[110px] font-semibold text-slate-700">Credit</TableHead>
                        <TableHead className="text-right w-[110px] font-semibold text-slate-700">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                            No financial activity yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((r) => (
                          <TableRow
                            key={r.id}
                            className={cn(
                              'hover:bg-slate-50/60',
                              r.type === 'payment' && 'bg-emerald-50/60'
                            )}
                          >
                            <TableCell className="text-slate-700 py-3 whitespace-nowrap">{formatDate(r.date)}</TableCell>
                            <TableCell className="font-medium text-slate-900 py-3 whitespace-nowrap">{r.reference}</TableCell>
                            <TableCell className="py-3" title={r.description}>
                              <div className="flex items-start gap-2">
                                <span
                                  className={cn(
                                    'mt-[1px] inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border whitespace-nowrap',
                                    r.type === 'payment'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  )}
                                >
                                  {r.type === 'payment' ? 'Payment' : 'Invoice'}
                                </span>
                                <span className="text-slate-700 truncate">{r.description}</span>
                              </div>
                            </TableCell>
                            <TableCell className={cn('text-right py-3 whitespace-nowrap', r.debit ? 'text-rose-700 font-medium' : 'text-slate-400')}>
                              {r.debit ? `Rs. ${r.debit.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className={cn('text-right py-3 whitespace-nowrap', r.credit ? 'text-emerald-700 font-medium' : 'text-slate-400')}>
                              {r.credit ? `Rs. ${r.credit.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className={cn('text-right py-3 whitespace-nowrap font-semibold', r.balance > 0 ? 'text-destructive' : 'text-slate-900')}>
                              Rs. {r.balance.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="no-print">
            <Button
              variant="outline"
              className="bg-white text-slate-900 border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => {
                setIsStatementOpen(false);
                try {
                  sessionStorage.removeItem(STATEMENT_VIEW_STORAGE_KEY);
                } catch {
                  // ignore
                }
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handlePrintStatement}
            >
              Print Statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Patient Dialog */}
      <Dialog
        open={isViewOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeViewDialog();
            return;
          }
          setIsViewOpen(true);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto pr-2">
          <DialogHeader className="pt-8 sm:pt-0">
            <DialogTitle>Customer Profile</DialogTitle>
          </DialogHeader>
          
          {selectedPatient && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedPatient.first_name} {selectedPatient.last_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedPatient.patient_number}</p>
                  <Badge variant={selectedPatient.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                    {selectedPatient.status}
                  </Badge>
                </div>
              </div>

              {(selectedPatient.allergies || selectedPatient.medical_conditions || selectedPatient.current_medications) && (
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="text-sm font-semibold text-foreground">Medical Info</h4>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {selectedPatient.allergies && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                        <div className="text-xs font-semibold text-destructive">Allergies</div>
                        <div className="mt-1 text-sm text-foreground break-words">{selectedPatient.allergies}</div>
                      </div>
                    )}
                    {selectedPatient.medical_conditions && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">Conditions</div>
                        <div className="mt-1 text-sm text-foreground break-words">{selectedPatient.medical_conditions}</div>
                      </div>
                    )}
                    {selectedPatient.current_medications && (
                      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Current medications</div>
                        <div className="mt-1 text-sm text-foreground break-words">{selectedPatient.current_medications}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(() => {
                if (isLoadingSelectedPatientInvoices) {
                  return (
                    <div className="rounded-lg border p-6 text-center text-muted-foreground">Loading cases...</div>
                  );
                }

                const patientInvoices = selectedPatientInvoices;
                const invoiceNumberById = new Map(patientInvoices.map((inv) => [inv.id, inv.invoice_number] as const));

                const getInvoiceSortKey = (inv: any) => {
                  const invoiceDate = inv.invoice_date || inv.created_at || '';
                  const createdAt = inv.created_at || '';
                  const invoiceNumber = inv.invoice_number || '';
                  const id = inv.id || '';
                  return { invoiceDate, createdAt, invoiceNumber, id };
                };

                const compareInvoiceAsc = (a: any, b: any) => {
                  const ka = getInvoiceSortKey(a);
                  const kb = getInvoiceSortKey(b);

                  const dateCmp = ka.invoiceDate.localeCompare(kb.invoiceDate);
                  if (dateCmp !== 0) return dateCmp;

                  const createdCmp = ka.createdAt.localeCompare(kb.createdAt);
                  if (createdCmp !== 0) return createdCmp;

                  const numCmp = ka.invoiceNumber.localeCompare(kb.invoiceNumber);
                  if (numCmp !== 0) return numCmp;

                  return ka.id.localeCompare(kb.id);
                };

                const patientInvoicesChronological = [...patientInvoices].sort(compareInvoiceAsc);
                
                const visitsCount = patientInvoicesChronological.length;
                const runningBalance = patientInvoicesChronological.reduce((sum, inv) => sum + (inv.balance || 0), 0);
                const totalBilled = patientInvoicesChronological.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
                const totalPaid = patientInvoicesChronological.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
                const lastVisit = patientInvoicesChronological
                  .map((inv) => inv.invoice_date || inv.created_at?.split('T')[0])
                  .filter(Boolean)
                  .sort()
                  .slice(-1)[0];

                const invoicesWithVisitNumbers = patientInvoicesChronological.map((inv, index) => ({
                  ...inv,
                  visit_number: index + 1,
                }));

                const invoiceToVisitMap = new Map(
                  invoicesWithVisitNumbers.map((inv) => [inv.id, inv.visit_number])
                );

                const displayInvoices = [...invoicesWithVisitNumbers].reverse();

                const sortedPayments = [...patientPayments].sort((a, b) => {
                  const visitA = invoiceToVisitMap.get(a.invoice_id) ?? -1;
                  const visitB = invoiceToVisitMap.get(b.invoice_id) ?? -1;
                  if (visitA !== visitB) return visitB - visitA;

                  const dateA = a.payment_date || a.created_at || '';
                  const dateB = b.payment_date || b.created_at || '';
                  return dateB.localeCompare(dateA);
                });

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        className={cn(
                          'rounded-lg border p-4',
                          runningBalance > 0
                            ? 'border-[rgba(255,61,113,0.3)] bg-[rgba(255,61,113,0.08)]'
                            : 'border-[rgba(0,214,143,0.3)] bg-[rgba(0,214,143,0.08)]'
                        )}
                      >
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding Balance</div>
                        <div className={cn('mt-1 text-2xl font-semibold', runningBalance > 0 ? 'text-destructive' : 'text-foreground')}>
                          Rs. {runningBalance.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-lg border p-4 bg-card">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Last Visit</div>
                        <div className="mt-1 text-2xl font-semibold text-foreground">{lastVisit || '-'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedPatient.phone}</span>
                </div>
                {selectedPatient.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedPatient.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Registered: {selectedPatient.registration_date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className={runningBalance > 0 ? 'text-destructive' : ''}>
                    Balance: Rs. {runningBalance.toLocaleString()}
                  </span>
                </div>
              </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="text-xs text-muted-foreground">Total Cases</div>
                        <div className="text-lg font-semibold">
                          {invoicesWithVisitNumbers.length}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="text-xs text-muted-foreground">Total Billed</div>
                        <div className="text-lg font-semibold">Rs. {totalBilled.toLocaleString()}</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="text-xs text-muted-foreground">Total Paid</div>
                        <div className="text-lg font-semibold">Rs. {totalPaid.toLocaleString()}</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-card">
                        <div className="text-xs text-muted-foreground">Last Visit</div>
                        <div className="text-lg font-semibold">{lastVisit || '-'}</div>
                      </div>
                    </div>

                    {/* Visits (Invoices) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Case History</h4>
                      </div>
                      {patientInvoicesChronological.length === 0 ? (
                        <div className="rounded-lg border p-6 text-center text-muted-foreground">No cases yet (no invoices found)</div>
                      ) : (
                        (() => {
                          const caseKeyForInvoice = (inv: Invoice) => {
                            return `invoice:${inv.id}`;
                          };

                          const caseKeyToInvoices = new Map<string, typeof invoicesWithVisitNumbers>();
                          for (const inv of invoicesWithVisitNumbers) {
                            const k = caseKeyForInvoice(inv);
                            const arr = caseKeyToInvoices.get(k) || [];
                            arr.push(inv);
                            caseKeyToInvoices.set(k, arr);
                          }

                          const caseKeysChronological = Array.from(caseKeyToInvoices.entries())
                            .map(([key, invs]) => {
                              const last = [...invs]
                                .map((i) => i.invoice_date || i.created_at?.split('T')[0] || '')
                                .filter(Boolean)
                                .sort()
                                .slice(-1)[0];
                              return { key, last };
                            })
                            .sort((a, b) => a.last.localeCompare(b.last));

                          const cases = caseKeysChronological.map(({ key }, idx) => {
                            const invs = (caseKeyToInvoices.get(key) || []).slice().sort(compareInvoiceAsc);
                            const billed = invs.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
                            const paid = invs.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
                            const balance = invs.reduce((sum, i) => sum + Number(i.balance || 0), 0);
                            const last = invs
                              .map((i) => i.invoice_date || i.created_at?.split('T')[0])
                              .filter(Boolean)
                              .sort()
                              .slice(-1)[0];
                            const caseNumber = idx + 1;
                            const caseIllness = (() => {
                              const lastInvoice = invs[invs.length - 1];
                              const names =
                                lastInvoice?.items
                                  ?.map((it) => (it.description || '').trim())
                                  .filter(Boolean) || [];

                              const seen = new Set<string>();
                              const unique = names.filter((n) => {
                                const key = n.toLowerCase();
                                if (seen.has(key)) return false;
                                seen.add(key);
                                return true;
                              });

                              return unique.join(', ');
                            })();
                            const invoiceIds = new Set(invs.map((i) => i.id));
                            const casePayments = patientPayments
                              .filter((p) => invoiceIds.has(p.invoice_id))
                              .slice()
                              .sort((a, b) => {
                                const da = a.payment_date || a.created_at || '';
                                const db = b.payment_date || b.created_at || '';
                                return db.localeCompare(da);
                              });

                            return {
                              key,
                              caseNumber,
                              caseIllness,
                              invoices: invs,
                              totals: { billed, paid, balance },
                              lastVisit: last,
                              payments: casePayments,
                            };
                          });

                          return (
                            <div className="rounded-lg border overflow-hidden">
                              <Accordion type="multiple" className="w-full">
                                {cases
                                  .slice()
                                  .reverse()
                                  .map((c) => (
                                    <AccordionItem key={c.key} value={c.key} className="px-4">
                                      <AccordionTrigger className="hover:no-underline">
                                        <div className="flex w-full items-center justify-between gap-4">
                                          <div className="text-left">
                                            <div className="font-semibold">
                                              Case #{c.caseNumber}
                                            </div>
                                            {(c.caseIllness || '').trim() && (
                                              <div className="text-xs text-muted-foreground">{c.caseIllness}</div>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-3 gap-3 text-right">
                                            <div>
                                              <div className="text-[11px] text-muted-foreground">Billed</div>
                                              <div className="text-sm font-semibold">Rs. {c.totals.billed.toLocaleString()}</div>
                                            </div>
                                            <div>
                                              <div className="text-[11px] text-muted-foreground">Paid</div>
                                              <div className="text-sm font-semibold text-success">Rs. {c.totals.paid.toLocaleString()}</div>
                                            </div>
                                            <div>
                                              <div className="text-[11px] text-muted-foreground">Balance</div>
                                              <div
                                                className={cn(
                                                  'text-sm font-semibold',
                                                  c.totals.balance > 0 ? 'text-destructive' : 'text-success'
                                                )}
                                              >
                                                Rs. {c.totals.balance.toLocaleString()}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent className="pt-4">
                                        <div className="space-y-4">
                                          <div className="rounded-lg border overflow-hidden">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead>Date</TableHead>
                                                  <TableHead>Invoice #</TableHead>
                                                  <TableHead className="text-right">Total</TableHead>
                                                  <TableHead className="text-right">Paid</TableHead>
                                                  <TableHead className="text-right">Balance</TableHead>
                                                  <TableHead>Status</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {c.invoices
                                                  .slice()
                                                  .reverse()
                                                  .map((inv) => (
                                                    <TableRow key={inv.id}>
                                                      <TableCell>{inv.invoice_date}</TableCell>
                                                      <TableCell className="font-mono text-sm">
                                                        <Button
                                                          type="button"
                                                          variant="link"
                                                          className="h-auto p-0 font-mono text-sm"
                                                          onClick={() => openInvoiceViewDialog(inv)}
                                                        >
                                                          {inv.invoice_number}
                                                        </Button>
                                                      </TableCell>
                                                      <TableCell className="text-right">Rs. {inv.total_amount.toLocaleString()}</TableCell>
                                                      <TableCell className="text-right">Rs. {inv.amount_paid.toLocaleString()}</TableCell>
                                                      <TableCell className={cn('text-right font-medium', inv.balance > 0 && 'text-destructive')}>
                                                        Rs. {inv.balance.toLocaleString()}
                                                      </TableCell>
                                                      <TableCell>
                                                        <Badge variant="outline" className={cn(statusColors[inv.status as any] || '')}>
                                                          {inv.status}
                                                        </Badge>
                                                      </TableCell>
                                                    </TableRow>
                                                  ))}
                                              </TableBody>
                                            </Table>
                                          </div>

                                          <div className="rounded-lg border p-4">
                                            <div className="flex items-center justify-between">
                                              <div className="font-medium">Payments</div>
                                              <div className="text-xs text-muted-foreground">
                                                {c.payments.length} payment{c.payments.length === 1 ? '' : 's'}
                                              </div>
                                            </div>

                                            {c.payments.length === 0 ? (
                                              <div className="mt-3 text-sm text-muted-foreground">No payments recorded for this case.</div>
                                            ) : (
                                              <div className="mt-3 space-y-2">
                                                {c.payments.map((p) => {
                                                  const invNum = invoiceNumberById.get(p.invoice_id);
                                                  return (
                                                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                                                      <div className="min-w-0">
                                                        <div className="text-sm font-medium truncate">
                                                          {p.payment_date}
                                                          {invNum ? ` • ${invNum}` : ''}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground capitalize">
                                                          {p.payment_method.replace('_', ' ')}
                                                          {p.reference_number ? ` • Ref: ${p.reference_number}` : ''}
                                                        </div>
                                                      </div>
                                                      <div className="text-sm font-semibold text-success whitespace-nowrap">Rs. {p.amount.toLocaleString()}</div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                              </Accordion>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Payments */}
                    {null}
                  </>
                );
              })()}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    openCreateInvoiceDialog(selectedPatient);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
                <Button variant="outline" onClick={closeViewDialog}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={openStatementDialog}
                >
                  View Statement
                </Button>
                <Button onClick={() => {
                  closeViewDialog();
                  openEditForm(selectedPatient);
                }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Customer
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <InvoiceViewDialog
        open={isInvoiceViewOpen}
        onOpenChange={(open) => {
          setIsInvoiceViewOpen(open);
          if (!open) {
            setSelectedInvoiceForView(null);
            try {
              sessionStorage.removeItem(INVOICE_VIEW_STORAGE_KEY);
            } catch {
              // ignore
            }
          }
        }}
        invoice={selectedInvoiceForView}
        onUpdatePayment={(inv) => {
          setIsInvoiceViewOpen(false);
          setSelectedInvoiceForView(null);
          try {
            sessionStorage.removeItem(INVOICE_VIEW_STORAGE_KEY);
          } catch {
            // ignore
          }
          openPaymentDialog(inv);
        }}
        onUpdateDiscount={handleInvoiceDiscountUpdate}
      />

      <Dialog
        open={isInvoiceCreateOpen}
        onOpenChange={(open) => {
          setIsInvoiceCreateOpen(open);
          if (!open) setIsCreatingInvoice(false);
          if (!open) {
            try {
              sessionStorage.removeItem(INVOICE_CREATE_DRAFT_STORAGE_KEY);
            } catch {
              // ignore
            }
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto z-[60]">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              {selectedPatient ? `Customer: ${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Create a new invoice'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateInvoice} className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="form-label mb-0">Items</label>
                <Button type="button" variant="outline" size="sm" onClick={addInvoiceItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {invoiceFormData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Select
                      value={item.description}
                      onValueChange={(v) => {
                        if (v === '__manage_services__') {
                          setTimeout(() => setIsServicesDialogOpen(true), 0);
                          return;
                        }
                        const treatment = treatmentTypes.find((t) => t.name === v);
                        updateInvoiceItem(index, 'description', v);
                        if (treatment) updateInvoiceItem(index, 'unit_price', treatment.default_price);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent>
                        {treatmentTypes.map((type) => (
                          <SelectItem key={type.id} value={type.name}>
                            {type.name} - Rs. {type.default_price.toLocaleString()}
                          </SelectItem>
                        ))}
                        <SelectItem value="__manage_services__" className="text-primary font-medium border-t mt-1 pt-2">
                          + Manage Services
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity || ''}
                      onChange={(e) => updateInvoiceItem(index, 'quantity', e.target.value === '' ? 1 : parseInt(e.target.value))}
                      placeholder="1"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      value={item.unit_price || ''}
                      onChange={(e) => updateInvoiceItem(index, 'unit_price', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-1 text-right font-medium py-2">
                    Rs. {Number(item.total || 0).toLocaleString()}
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInvoiceItem(index)}
                      disabled={invoiceFormData.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-medium">Rs. {calculateInvoiceTotals().subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Discount</span>
                <Input
                  type="number"
                  min="0"
                  value={invoiceFormData.discount_amount || ''}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, discount_amount: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  className="w-32 text-right"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Tax</span>
                <Input
                  type="number"
                  min="0"
                  value={invoiceFormData.tax_amount || ''}
                  onChange={(e) => setInvoiceFormData({ ...invoiceFormData, tax_amount: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  className="w-32 text-right"
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span>Rs. {calculateInvoiceTotals().total.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="form-label">Notes</label>
              <Textarea
                value={invoiceFormData.notes}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
                placeholder="Additional notes"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInvoiceCreateOpen(false)} disabled={isCreatingInvoice}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingInvoice || !selectedPatient}>
                Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Payment Dialog (from patient profile) */}
      <Dialog
        open={isPaymentOpen}
        onOpenChange={(open) => {
          setIsPaymentOpen(open);
          if (!open) setSelectedInvoiceForPayment(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Payment</DialogTitle>
            <DialogDescription>
              {selectedInvoiceForPayment
                ? `Invoice ${selectedInvoiceForPayment.invoice_number} (Balance: Rs. ${selectedInvoiceForPayment.balance.toLocaleString()})`
                : 'Select invoice'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePatientPayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="form-label">Amount *</label>
                <Input
                  type="number"
                  min="0"
                  value={paymentData.amount || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value === '' ? 0 : Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="col-span-2">
                <label className="form-label">Payment Method *</label>
                <Select
                  value={paymentData.payment_method}
                  onValueChange={(v) => setPaymentData({ ...paymentData, payment_method: v as PaymentMethod })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="form-label">Reference #</label>
                <Input
                  value={paymentData.reference_number}
                  onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="col-span-2">
                <label className="form-label">Notes</label>
                <Textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Optional"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedInvoiceForPayment}>
                Save Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ArchivePatientDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setIsDeleteOpen(open);
          if (!open) setPatientToDelete(null);
        }}
        patient={patientToDelete}
        isArchiving={isDeleting}
        onConfirm={confirmArchivePatient}
      />

      <DuplicatePatientDialog
        open={duplicateModalOpen}
        onOpenChange={(open) => {
          setDuplicateModalOpen(open);
          if (!open) {
            setDuplicatePatientInfo(null);
            setDuplicatePatientWarningForPhone(null);
          }
        }}
        duplicatePatient={duplicatePatientInfo}
        onViewExisting={handleDuplicateCancel}
        onCreateAnyway={handleDuplicateConfirm}
      />

      <RestorePatientDialog
        open={isRestoreOpen}
        onOpenChange={(open) => {
          if (isRestoring) return;
          setIsRestoreOpen(open);
          if (!open) setPatientToRestore(null);
        }}
        patient={patientToRestore}
        isRestoring={isRestoring}
        onConfirm={confirmRestorePatient}
      />

      {/* Services (Treatment Types) Management Dialog */}
      <Dialog open={isServicesDialogOpen} onOpenChange={setIsServicesDialogOpen}>
        <DialogContent overlayClassName="z-[70]" className="max-w-2xl max-h-[80vh] overflow-y-auto z-[80]">
          <DialogHeader>
            <DialogTitle>Manage Services</DialogTitle>
            <DialogDescription>
              Add, edit, or remove services that can be added to invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Service Form */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
              <h4 className="font-medium text-sm">
                {serviceFormMode === 'create' ? 'Add New Service' : 'Edit Service'}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Service Name *</Label>
                  <Input
                    value={serviceFormData.name}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                    placeholder="e.g., Consultation"
                  />
                </div>
                <div>
                  <Label className="text-xs">Code</Label>
                  <Input
                    value={serviceFormData.code}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, code: e.target.value })}
                    placeholder="e.g., CONS-001"
                  />
                </div>
                <div>
                  <Label className="text-xs">Default Price (Rs.) *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={serviceFormData.default_price || ''}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, default_price: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Duration (minutes)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={serviceFormData.duration_minutes || ''}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, duration_minutes: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                    placeholder="30"
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Input
                    value={serviceFormData.category}
                    onChange={(e) => setServiceFormData({ ...serviceFormData, category: e.target.value })}
                    placeholder="e.g., General"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!serviceFormData.name.trim()) {
                      toast({ title: 'Error', description: 'Service name is required', variant: 'destructive' });
                      return;
                    }
                    if (serviceFormMode === 'create') {
                      const result = await createTreatmentType({
                        name: serviceFormData.name.trim(),
                        code: serviceFormData.code || undefined,
                        default_price: serviceFormData.default_price,
                        duration_minutes: serviceFormData.duration_minutes,
                        category: serviceFormData.category || 'General',
                        is_active: true,
                      });
                      if (result.success) {
                        toast({ title: 'Service Created', description: `${serviceFormData.name} has been added` });
                        setServiceFormData({ name: '', code: '', default_price: 0, duration_minutes: 30, category: '', is_active: true });
                      } else {
                        toast({ title: 'Error', description: result.error || 'Failed to create service', variant: 'destructive' });
                      }
                    } else if (selectedService) {
                      const result = await updateTreatmentType(selectedService.id, {
                        name: serviceFormData.name.trim(),
                        code: serviceFormData.code || undefined,
                        default_price: serviceFormData.default_price,
                        duration_minutes: serviceFormData.duration_minutes,
                        category: serviceFormData.category || 'General',
                        is_active: serviceFormData.is_active,
                      });
                      if (result.success) {
                        toast({ title: 'Service Updated', description: `${serviceFormData.name} has been updated` });
                        setServiceFormMode('create');
                        setSelectedService(null);
                        setServiceFormData({ name: '', code: '', default_price: 0, duration_minutes: 30, category: '', is_active: true });
                      } else {
                        toast({ title: 'Error', description: result.error || 'Failed to update service', variant: 'destructive' });
                      }
                    }
                  }}
                >
                  {serviceFormMode === 'create' ? 'Add Service' : 'Update Service'}
                </Button>
                {serviceFormMode === 'edit' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setServiceFormMode('create');
                      setSelectedService(null);
                      setServiceFormData({ name: '', code: '', default_price: 0, duration_minutes: 30, category: '', is_active: true });
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Services List */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Service Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatmentTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No services defined yet. Add your first service above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    treatmentTypes.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell className="text-muted-foreground">{service.code || '-'}</TableCell>
                        <TableCell className="text-right">Rs. {service.default_price.toLocaleString()}</TableCell>
                        <TableCell>{service.category || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setServiceFormMode('edit');
                                setSelectedService(service);
                                setServiceFormData({
                                  name: service.name,
                                  code: service.code || '',
                                  default_price: service.default_price,
                                  duration_minutes: service.duration_minutes,
                                  category: service.category || '',
                                  is_active: service.is_active,
                                });
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={async () => {
                                const result = await deleteTreatmentType(service.id);
                                if (result.success) {
                                  toast({ title: 'Service Deleted', description: `${service.name} has been removed` });
                                } else {
                                  toast({ title: 'Error', description: result.error || 'Failed to delete service', variant: 'destructive' });
                                }
                              }}
                            >
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsServicesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
}
