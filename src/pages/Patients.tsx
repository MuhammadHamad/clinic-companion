import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLocation, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { usePatients } from '@/hooks/usePatients';
import { useInvoices } from '@/hooks/useInvoices';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, Patient, Payment, PaymentMethod } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTablePagination } from '@/components/ui/data-table-pagination';

 const statusColors: Record<string, string> = {
   draft: 'bg-muted text-muted-foreground',
   unpaid: 'bg-financial-unpaid/10 text-financial-unpaid border-financial-unpaid/20',
   partial: 'bg-financial-partial/10 text-financial-partial border-financial-partial/20',
   paid: 'bg-financial-paid/10 text-financial-paid border-financial-paid/20',
   overdue: 'bg-financial-overdue/10 text-financial-overdue border-financial-overdue/20',
 };

export default function Patients() {
  const { patients, isLoading, createPatient, updatePatient, deletePatient } = usePatients();
  const { invoices, recordPayment } = useInvoices();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicatePatientWarningForPhone, setDuplicatePatientWarningForPhone] = useState<string | null>(null);
  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

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

  const [isStatementOpen, setIsStatementOpen] = useState(false);

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

  const filteredPatients = patients.filter(patient => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const patientDigits = (patient.phone || '').replace(/\D/g, '');

    const matchesSearch =
      patient.first_name.toLowerCase().includes(q) ||
      patient.last_name.toLowerCase().includes(q) ||
      (qDigits.length > 0 ? patientDigits.includes(qDigits) : false) ||
      patient.patient_number.toLowerCase().includes(q);
    
    const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q && q !== searchQuery) setSearchQuery(q);
  }, [location.search, searchQuery]);

  const invoiceSummaryByPatientId = useMemo(() => {
    const map = new Map<string, { balance: number; lastVisit: string | null }>();

    for (const inv of invoices) {
      const patientId = inv.patient_id;
      if (!patientId) continue;

      const current = map.get(patientId) || { balance: 0, lastVisit: null };
      current.balance += Number(inv.balance || 0);

      const visitDate = inv.invoice_date || inv.created_at?.split('T')[0] || null;
      if (visitDate && (!current.lastVisit || visitDate > current.lastVisit)) {
        current.lastVisit = visitDate;
      }

      map.set(patientId, current);
    }

    return map;
  }, [invoices]);

  // Pagination calculations
  const totalPatients = filteredPatients.length;
  const totalPages = Math.ceil(totalPatients / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalPatients);
  const currentPagePatients = filteredPatients.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

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
    setSelectedPatient(patient);
    setFormData({
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
    });
    setDuplicatePatientWarningForPhone(null);
    setIsFormOpen(true);
  };

  const openViewDialog = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsViewOpen(true);
  };

  const loadPatientPayments = async (patientId: string) => {
    try {
      setIsLoadingPayments(true);
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
      console.error('Error fetching patient payments:', err);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (!isViewOpen || !selectedPatient) return;
    loadPatientPayments(selectedPatient.id);
  }, [isViewOpen, selectedPatient?.id]);

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
        title: 'Payment Recorded',
        description: 'Payment has been recorded successfully',
      });
      await loadPatientPayments(selectedPatient.id);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to record payment',
        variant: 'destructive',
      });
    }
  };

  const openDeleteDialog = (patient: Patient) => {
    setPatientToDelete(patient);
    setIsDeleteOpen(true);
  };

  const confirmDeletePatient = async () => {
    if (!patientToDelete) return;
    setIsDeleting(true);

    const result = await deletePatient(patientToDelete.id);

    if (result.success) {
      toast({
        title: 'Patient deleted',
        description: 'The patient record has been removed successfully.',
      });
      setIsDeleteOpen(false);
      setPatientToDelete(null);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete patient',
        variant: 'destructive',
      });
    }

    setIsDeleting(false);
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
      setIsFormOpen(false);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create patient',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateModalOpen(false);
    setDuplicatePatientInfo(null);
    setDuplicatePatientWarningForPhone(null);
    setIsSubmitting(true);
    await createPatientFromForm();
    setIsSubmitting(false);
  };

  const handleDuplicateCancel = () => {
    setDuplicateModalOpen(false);
    setDuplicatePatientInfo(null);
    setDuplicatePatientWarningForPhone(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name || !formData.last_name || !formData.phone) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (formMode === 'create') {
      const normalizedPhone = formData.phone.trim();
      const existing = patients.find(
        (p) => p.phone && p.phone.trim() === normalizedPhone
      );

      if (existing && duplicatePatientWarningForPhone !== normalizedPhone) {
        setDuplicatePatientWarningForPhone(normalizedPhone);
        setDuplicatePatientInfo(existing);
        setDuplicateModalOpen(true);
        return;
      }
    }

    setIsSubmitting(true);

    if (formMode === 'create') {
      await createPatientFromForm();
    } else if (selectedPatient) {
      const result = await updatePatient(selectedPatient.id, {
        ...formData,
        gender: formData.gender as 'male' | 'female' | 'other' | undefined,
      });

      if (result.success) {
        toast({
          title: 'Patient Updated',
          description: 'Patient information has been updated successfully',
        });
        setIsFormOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update patient',
          variant: 'destructive',
        });
      }
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Patients" subtitle="Manage your patient records" />
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
    <div className="min-h-screen">
      <Header title="Patients" subtitle="Manage your patient records" />
      
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or patient #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            Add Patient
          </Button>
        </div>

        {/* Patients Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Patient #</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Age</TableHead>
                <TableHead className="font-semibold">Phone</TableHead>
                <TableHead className="font-semibold">Last Visit</TableHead>
                <TableHead className="font-semibold">Balance</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPagePatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {totalPatients === 0 ? 'No patients found' : 'No patients on this page'}
                  </TableCell>
                </TableRow>
              ) : (
                currentPagePatients.map((patient) => {
                  const summary = invoiceSummaryByPatientId.get(patient.id);
                  const lastVisit = summary?.lastVisit || patient.last_visit_date || '-';
                  const balance = summary ? summary.balance : (patient.balance || 0);

                  return (
                    <TableRow key={patient.id} className="data-table-row">
                      <TableCell className="font-medium text-primary">{patient.patient_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{patient.first_name} {patient.last_name}</div>
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
                        <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
                          {patient.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openViewDialog(patient)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditForm(patient)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(patient)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Register New Patient' : 'Edit Patient'}</DialogTitle>
            <DialogDescription>
              {formMode === 'create' 
                ? 'Fill in the patient information below' 
                : 'Update the patient information'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">First Name *</label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Last Name *</label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    placeholder="Enter last name"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Phone *</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="0321-1234567"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="patient@email.com"
                  />
                </div>
                <div>
                  <label className="form-label">Date of Birth</label>
                  <Input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                  />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Address</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label className="form-label">City</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="form-label">Emergency Contact Name</label>
                  <Input
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})}
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <label className="form-label">Emergency Contact Phone</label>
                  <Input
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})}
                    placeholder="0321-1234567"
                  />
                </div>
              </div>
            </div>

            {/* Medical Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Medical Information</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="form-label">Allergies</label>
                  <Textarea
                    value={formData.allergies}
                    onChange={(e) => setFormData({...formData, allergies: e.target.value})}
                    placeholder="List any known allergies"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="form-label">Current Medications</label>
                  <Textarea
                    value={formData.current_medications}
                    onChange={(e) => setFormData({...formData, current_medications: e.target.value})}
                    placeholder="List current medications"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="form-label">Medical Conditions</label>
                  <Textarea
                    value={formData.medical_conditions}
                    onChange={(e) => setFormData({...formData, medical_conditions: e.target.value})}
                    placeholder="List any medical conditions"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="form-label">Notes</label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Additional notes"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {formMode === 'create' ? 'Register Patient' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Patient Statement (Ledger) Dialog */}
      <Dialog
        open={isStatementOpen}
        onOpenChange={setIsStatementOpen}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto pr-2 patient-statement-print !bg-white !text-slate-900 !border-0">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-900">Patient Statement</DialogTitle>
            <DialogDescription className="text-slate-600">
              {selectedPatient
                ? `Financial history for ${selectedPatient.first_name} ${selectedPatient.last_name}`
                : 'Patient financial history'}
            </DialogDescription>
          </DialogHeader>

          {selectedPatient && (() => {
            const patientInvoices = invoices.filter((inv) => inv.patient_id === selectedPatient.id);

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
                reference: invoices.find((inv) => inv.id === p.invoice_id)?.invoice_number || '-',
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
                      <div className="text-xs font-medium text-slate-600">Patient</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">Patient ID:</span> {selectedPatient.patient_number || '-'}
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
              className="bg-white text-slate-900 border-slate-300 hover:bg-slate-50"
              onClick={() => setIsStatementOpen(false)}
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
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle>Patient Profile</DialogTitle>
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

              {(() => {
                const patientInvoices = invoices.filter((inv) => inv.patient_id === selectedPatient.id);

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
                        <div className={cn('mt-1 text-2xl font-semibold', runningBalance > 0 ? 'text-destructive' : 'text-success')}>
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
                        <div className="text-xs text-muted-foreground">Total Visits</div>
                        <div className="text-lg font-semibold">{visitsCount}</div>
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
                        <h4 className="font-medium">Visit History (Invoices)</h4>
                      </div>
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Visit #</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Invoice #</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {patientInvoicesChronological.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                  No visits yet (no invoices found)
                                </TableCell>
                              </TableRow>
                            ) : (
                              displayInvoices.map((inv) => (
                                <TableRow key={inv.id}>
                                  <TableCell className="font-medium text-primary">
                                    Visit #{inv.visit_number}
                                  </TableCell>
                                  <TableCell>{inv.invoice_date}</TableCell>
                                  <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
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
                                  <TableCell className="text-right">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={inv.balance <= 0}
                                      onClick={() => openPaymentDialog(inv)}
                                    >
                                      Record Payment
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Payments */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Payment History</h4>
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Visit #</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Method</TableHead>
                              <TableHead>Invoice</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isLoadingPayments ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  Loading payments...
                                </TableCell>
                              </TableRow>
                            ) : patientPayments.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  No payments found
                                </TableCell>
                              </TableRow>
                            ) : (
                              sortedPayments.map((p) => {
                                const visitNumber = invoiceToVisitMap.get(p.invoice_id);
                                return (
                                  <TableRow key={p.id}>
                                    <TableCell className="font-medium text-primary">
                                      {visitNumber ? `Visit #${visitNumber}` : '-'}
                                    </TableCell>
                                    <TableCell>{p.payment_date}</TableCell>
                                    <TableCell className="capitalize">{p.payment_method.replace('_', ' ')}</TableCell>
                                    <TableCell className="font-mono text-sm">
                                      {invoices.find((inv) => inv.id === p.invoice_id)?.invoice_number || '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">Rs. {p.amount.toLocaleString()}</TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                );
              })()}

              {(selectedPatient.allergies || selectedPatient.medical_conditions) && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm">Medical Info</h4>
                  {selectedPatient.allergies && (
                    <div className="text-sm">
                      <span className="text-destructive font-medium">Allergies: </span>
                      {selectedPatient.allergies}
                    </div>
                  )}
                  {selectedPatient.medical_conditions && (
                    <div className="text-sm">
                      <span className="font-medium">Conditions: </span>
                      {selectedPatient.medical_conditions}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsViewOpen(false);
                    navigate(`/invoices?patientId=${encodeURIComponent(selectedPatient.id)}`);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsStatementOpen(true)}
                >
                  View Statement
                </Button>
                <Button onClick={() => {
                  setIsViewOpen(false);
                  openEditForm(selectedPatient);
                }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Patient
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog (from patient profile) */}
      <Dialog
        open={isPaymentOpen}
        onOpenChange={(open) => {
          setIsPaymentOpen(open);
          if (!open) setSelectedInvoiceForPayment(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
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
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
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
                    <SelectItem value="cheque">Cheque</SelectItem>
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

      <AlertDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setIsDeleteOpen(open);
          if (!open) setPatientToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete patient</AlertDialogTitle>
            <AlertDialogDescription>
              {patientToDelete
                ? `Are you sure you want to delete patient ${patientToDelete.first_name} ${patientToDelete.last_name}? This action cannot be undone.`
                : 'Are you sure you want to delete this patient? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting || !patientToDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDeletePatient();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Patient Confirmation Modal */}
      <Dialog
        open={duplicateModalOpen}
        onOpenChange={(open) => {
          setDuplicateModalOpen(open);
          if (!open) {
            setDuplicatePatientInfo(null);
            setDuplicatePatientWarningForPhone(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Possible Duplicate Patient</DialogTitle>
            <DialogDescription>
              A patient with this phone number already exists in the system.
            </DialogDescription>
          </DialogHeader>
          
          {duplicatePatientInfo && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">Existing Patient:</h4>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Name:</span> {duplicatePatientInfo.first_name} {duplicatePatientInfo.last_name}</div>
                <div><span className="font-medium">Phone:</span> {duplicatePatientInfo.phone}</div>
                <div><span className="font-medium">Patient ID:</span> {duplicatePatientInfo.patient_number}</div>
                {duplicatePatientInfo.email && (
                  <div><span className="font-medium">Email:</span> {duplicatePatientInfo.email}</div>
                )}
              </div>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            If this is the same person, consider opening their existing record instead of creating a duplicate.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleDuplicateCancel}>
              Cancel
            </Button>
            <Button onClick={handleDuplicateConfirm}>
              Create Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
