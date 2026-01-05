import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useInvoices, usePatients, useTreatmentTypes } from '@/hooks';
import { invoiceSchema, paymentSchema, type InvoiceFormData, type PaymentFormData } from '@/lib/validation';
import { 
  Plus, 
  Search, 
  Eye, 
  Printer,
  DollarSign,
  Filter,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { Invoice, InvoiceItem, InvoiceStatus, PaymentMethod } from '@/types';
import { useToast } from '@/hooks';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  unpaid: 'bg-financial-unpaid/10 text-financial-unpaid border-financial-unpaid/20',
  partial: 'bg-financial-partial/10 text-financial-partial border-financial-partial/20',
  paid: 'bg-financial-paid/10 text-financial-paid border-financial-paid/20',
  overdue: 'bg-financial-overdue/10 text-financial-overdue border-financial-overdue/20',
};

export default function Invoices() {
  const { invoices, isLoading, fetchInvoices, createInvoice, recordPayment, deleteInvoice } = useInvoices();
  const { patients } = usePatients();
  const { treatmentTypes } = useTreatmentTypes();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    patient_id: '',
    items: [{ description: '', tooth_number: '', quantity: 1, unit_price: 0, total: 0 }] as InvoiceItem[],
    discount_amount: 0,
    tax_amount: 0,
    payment_terms: '',
    notes: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: undefined as PaymentMethod | undefined,
    reference_number: '',
    notes: '',
  });

  const totalOutstanding = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + i.balance, 0);

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.patient?.first_name && invoice.patient.first_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (invoice.patient?.last_name && invoice.patient.last_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (invoice.patient?.phone && invoice.patient.phone.includes(searchQuery));
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination calculations
  const totalInvoices = filteredInvoices.length;
  const totalPages = Math.ceil(totalInvoices / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalInvoices);
  const currentPageInvoices = filteredInvoices.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q && q !== searchQuery) setSearchQuery(q);
  }, [location.search, searchQuery]);

  const openCreateForm = () => {
    setFormData({
      patient_id: '',
      items: [{ id: '1', invoice_id: '', description: '', tooth_number: '', quantity: 1, unit_price: 0, total: 0 }],
      discount_amount: 0,
      tax_amount: 0,
      payment_terms: '',
      notes: '',
    });
    setIsFormOpen(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const patientId = params.get('patientId');
    if (!patientId) return;

    setFormData((prev) => ({
      ...prev,
      patient_id: patientId,
      items: prev.items?.length
        ? prev.items
        : [{ id: '1', invoice_id: '', description: '', tooth_number: '', quantity: 1, unit_price: 0, total: 0 }],
    }));
    setIsFormOpen(true);

    params.delete('patientId');
    const nextSearch = params.toString();
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const openViewDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewOpen(true);
  };

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: invoice.balance,
      payment_method: undefined,
      reference_number: '',
      notes: '',
    });
    setIsPaymentOpen(true);
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { id: String(Date.now()), invoice_id: '', description: '', tooth_number: '', quantity: 1, unit_price: 0, total: 0 }],
    });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...formData.items];
    (newItems[index] as any)[field] = value;
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index),
      });
    }
  };

  const openDeleteDialog = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setIsDeleteOpen(true);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);

    const result = await deleteInvoice(invoiceToDelete.id);

    if (result.success) {
      toast({
        title: 'Invoice deleted',
        description: 'The invoice has been removed successfully.',
      });
      setIsDeleteOpen(false);
      setInvoiceToDelete(null);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete invoice',
        variant: 'destructive',
      });
    }

    setIsDeleting(false);
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal - formData.discount_amount + formData.tax_amount;
    return { subtotal, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data with Zod
    const validationResult = invoiceSchema.safeParse(formData);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(err => err.message).join('. ');
      toast({
        title: 'Validation Error',
        description: errorMessages,
        variant: 'destructive',
      });
      return;
    }

    const { subtotal, total } = calculateTotals();
    
    const result = await createInvoice({
      patient_id: formData.patient_id,
      items: formData.items.filter(i => i.description),
      discount_amount: formData.discount_amount,
      tax_amount: formData.tax_amount,
      payment_terms: formData.payment_terms,
      notes: formData.notes,
    });

    if (result.success) {
      setIsFormOpen(false);
      toast({
        title: 'Invoice Created',
        description: `Invoice created for Rs. ${total.toLocaleString()}`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate payment data with Zod
    const validationResult = paymentSchema.safeParse(paymentData);
    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(err => err.message).join('. ');
      toast({
        title: 'Validation Error',
        description: errorMessages,
        variant: 'destructive',
      });
      return;
    }

    const result = await recordPayment(selectedInvoice.id, {
      amount: paymentData.amount,
      payment_method: paymentData.payment_method,
      reference_number: paymentData.reference_number,
      notes: paymentData.notes,
    });

    if (result.success) {
      setIsPaymentOpen(false);
      toast({
        title: 'Payment Recorded',
        description: `Rs. ${paymentData.amount.toLocaleString()} payment recorded successfully`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <Header title="Invoices" subtitle="Manage billing and payments" />
      
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
        {/* Outstanding Summary */}
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-4 sm:p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground opacity-80">Total Outstanding</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">Rs. {totalOutstanding.toLocaleString()}</p>
            </div>
            <DollarSign className="h-10 w-10 sm:h-12 sm:w-12 opacity-20" />
          </CardContent>
        </Card>

        {/* Actions Bar */}
        <div className="invoices-actions-bar flex flex-col gap-4">
          <div className="invoices-actions-row flex flex-col sm:flex-row gap-3">
            <div className="invoices-search relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice # or patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="invoices-status-trigger w-full sm:w-36">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreateForm} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        <style>{`
          @media (hover: hover) and (pointer: fine) {
            .invoices-actions-bar {
              flex-direction: row;
              align-items: center;
            }
            .invoices-actions-row {
              flex: 1;
              flex-direction: row;
              align-items: center;
            }
            .invoices-search {
              flex: 0 1 36rem;
              max-width: 36rem;
            }
            .invoices-status-trigger {
              width: 9rem;
            }
            .invoices-actions-bar > button {
              width: auto !important;
              white-space: nowrap;
            }
          }
        `}</style>

        {/* Invoices Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold whitespace-nowrap">Invoice #</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Patient</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Date</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Total</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Paid</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Balance</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
                  <TableHead className="font-semibold text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {currentPageInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {totalInvoices === 0 ? 'No invoices found' : 'No invoices on this page'}
                  </TableCell>
                </TableRow>
              ) : (
                currentPageInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="data-table-row">
                    <TableCell className="font-medium text-primary">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      {invoice.patient?.first_name} {invoice.patient?.last_name}
                    </TableCell>
                    <TableCell>{invoice.invoice_date}</TableCell>
                    <TableCell className="text-right font-medium">
                      Rs. {invoice.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-success">
                      Rs. {invoice.amount_paid.toLocaleString()}
                    </TableCell>
                    <TableCell className={cn(
                      'text-right font-medium',
                      invoice.balance > 0 ? 'text-destructive' : 'text-foreground'
                    )}>
                      Rs. {invoice.balance.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('capitalize', statusColors[invoice.status])}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openViewDialog(invoice)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View</p>
                          </TooltipContent>
                        </Tooltip>
                        {invoice.status !== 'paid' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openPaymentDialog(invoice)}
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Payment</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Print</p>
                          </TooltipContent>
                        </Tooltip>
                        {invoice.status !== 'paid' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(invoice)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalInvoices > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalInvoices}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Create Invoice Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>Create a new invoice for a patient</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="form-label">Patient *</label>
              <Select value={formData.patient_id} onValueChange={(v) => setFormData({...formData, patient_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.filter(p => p.status === 'active').map(patient => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} ({patient.patient_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="form-label mb-0">Items</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add Item</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Select 
                      value={item.description} 
                      onValueChange={(v) => {
                        const treatment = treatmentTypes.find(t => t.name === v);
                        updateItem(index, 'description', v);
                        if (treatment) {
                          updateItem(index, 'unit_price', treatment.default_price);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select treatment" />
                      </SelectTrigger>
                      <SelectContent>
                        {treatmentTypes.map(type => (
                          <SelectItem key={type.id} value={type.name}>
                            {type.name} - Rs. {type.default_price.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Tooth #"
                      value={item.tooth_number || ''}
                      onChange={(e) => updateItem(index, 'tooth_number', e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2 text-right font-medium py-2">
                    Rs. {item.total.toLocaleString()}
                  </div>
                  <div className="col-span-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Remove</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-medium">Rs. {calculateTotals().subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Discount</span>
                <Input
                  type="number"
                  min="0"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({...formData, discount_amount: parseFloat(e.target.value) || 0})}
                  className="w-32 text-right"
                />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Tax</span>
                <Input
                  type="number"
                  min="0"
                  value={formData.tax_amount}
                  onChange={(e) => setFormData({...formData, tax_amount: parseFloat(e.target.value) || 0})}
                  className="w-32 text-right"
                />
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span>Rs. {calculateTotals().total.toLocaleString()}</span>
              </div>
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Invoice</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-6 border-b border-border">
            <DialogTitle className="text-2xl font-bold text-foreground">
              Invoice {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-8 py-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</p>
                  <p className="text-lg font-medium text-foreground">
                    {selectedInvoice.patient?.first_name} {selectedInvoice.patient?.last_name}
                  </p>
                </div>
                <div className="text-right space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</p>
                  <p className="text-lg font-medium text-foreground">{selectedInvoice.invoice_date}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Services & Items</h3>
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-semibold text-foreground">Description</TableHead>
                        <TableHead className="font-semibold text-foreground">Tooth</TableHead>
                        <TableHead className="text-right font-semibold text-foreground">Qty</TableHead>
                        <TableHead className="text-right font-semibold text-foreground">Price</TableHead>
                        <TableHead className="text-right font-semibold text-foreground">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.items?.map((item, index) => (
                        <TableRow key={index} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-medium text-foreground">{item.description}</TableCell>
                          <TableCell className="text-muted-foreground">{item.tooth_number || '-'}</TableCell>
                          <TableCell className="text-right text-foreground">{item.quantity}</TableCell>
                          <TableCell className="text-right text-foreground">Rs. {item.unit_price.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium text-foreground">Rs. {item.total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totals Section */}
              <div className="grid grid-cols-2 gap-8">
                <div></div>
                <div className="space-y-1">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="text-sm font-medium text-foreground">Rs. {selectedInvoice.subtotal.toLocaleString()}</span>
                  </div>
                  {selectedInvoice.discount_amount > 0 && (
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Discount</span>
                      <span className="text-sm font-medium text-success">-Rs. {selectedInvoice.discount_amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-t border-border">
                    <span className="text-base font-semibold text-foreground">Total</span>
                    <span className="text-base font-bold text-foreground">Rs. {selectedInvoice.total_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-muted-foreground">Paid</span>
                    <span className="text-sm font-medium text-success">Rs. {selectedInvoice.amount_paid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t border-border">
                    <span className="text-lg font-bold text-foreground">Balance Due</span>
                    <span className={cn(
                      "text-lg font-bold",
                      selectedInvoice.balance > 0 ? "text-destructive" : "text-success"
                    )}>
                      Rs. {selectedInvoice.balance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button variant="outline" className="flex-1 h-11">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                {selectedInvoice.status !== 'paid' && (
                  <Button className="flex-1 h-11" onClick={() => { setIsViewOpen(false); openPaymentDialog(selectedInvoice); }}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Invoice {selectedInvoice?.invoice_number} • Balance: Rs. {selectedInvoice?.balance.toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handlePayment} className="space-y-4">
            <div>
              <label className="form-label">Amount *</label>
              <Input
                type="number"
                min="0"
                max={selectedInvoice?.balance}
                value={paymentData.amount}
                onChange={(e) => setPaymentData({...paymentData, amount: parseFloat(e.target.value) || 0})}
                required
              />
            </div>

            <div>
              <label className="form-label">Payment Method *</label>
              <Select value={paymentData.payment_method} onValueChange={(v) => setPaymentData({...paymentData, payment_method: v as PaymentMethod})}>
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

            <div>
              <label className="form-label">Reference Number</label>
              <Input
                value={paymentData.reference_number}
                onChange={(e) => setPaymentData({...paymentData, reference_number: e.target.value})}
                placeholder="Transaction ID, cheque number, etc."
              />
            </div>

            <div>
              <label className="form-label">Notes</label>
              <Textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                placeholder="Additional notes"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Record Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setIsDeleteOpen(open);
          if (!open) setInvoiceToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToDelete
                ? `Are you sure you want to delete invoice ${invoiceToDelete.invoice_number}? This action cannot be undone.`
                : 'Are you sure you want to delete this invoice? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting || !invoiceToDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteInvoice();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </div>
      </div>
    </TooltipProvider>
  );
}
