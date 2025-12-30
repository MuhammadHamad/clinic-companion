import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Printer,
  DollarSign,
  Filter,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { mockInvoices, mockPatients, mockTreatmentTypes } from '@/data/mockData';
import { Invoice, InvoiceItem, InvoiceStatus, PaymentMethod } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  unpaid: 'bg-financial-unpaid/10 text-financial-unpaid border-financial-unpaid/20',
  partial: 'bg-financial-partial/10 text-financial-partial border-financial-partial/20',
  paid: 'bg-financial-paid/10 text-financial-paid border-financial-paid/20',
  overdue: 'bg-financial-overdue/10 text-financial-overdue border-financial-overdue/20',
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const { toast } = useToast();

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
    payment_method: '' as PaymentMethod | '',
    reference_number: '',
    notes: '',
  });

  const totalOutstanding = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + i.balance, 0);

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.patient?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.patient?.last_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

  const openViewDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewOpen(true);
  };

  const openPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      amount: invoice.balance,
      payment_method: '',
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

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal - formData.discount_amount + formData.tax_amount;
    return { subtotal, total };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patient_id || formData.items.every(i => !i.description)) {
      toast({
        title: 'Validation Error',
        description: 'Please select a patient and add at least one item',
        variant: 'destructive',
      });
      return;
    }

    const patient = mockPatients.find(p => p.id === formData.patient_id);
    const { subtotal, total } = calculateTotals();
    
    const newInvoice: Invoice = {
      id: String(Date.now()),
      invoice_number: `INV-${String(invoices.length + 1).padStart(3, '0')}`,
      patient_id: formData.patient_id,
      invoice_date: new Date().toISOString().split('T')[0],
      subtotal,
      discount_amount: formData.discount_amount,
      tax_amount: formData.tax_amount,
      total_amount: total,
      amount_paid: 0,
      balance: total,
      status: 'unpaid',
      payment_terms: formData.payment_terms,
      notes: formData.notes,
      created_at: new Date().toISOString(),
      patient,
      items: formData.items.filter(i => i.description),
    };

    setInvoices([newInvoice, ...invoices]);
    setIsFormOpen(false);
    toast({
      title: 'Invoice Created',
      description: `Invoice ${newInvoice.invoice_number} created for Rs. ${total.toLocaleString()}`,
    });
  };

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentData.payment_method || paymentData.amount <= 0 || !selectedInvoice) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid amount and payment method',
        variant: 'destructive',
      });
      return;
    }

    const newAmountPaid = selectedInvoice.amount_paid + paymentData.amount;
    const newBalance = selectedInvoice.total_amount - newAmountPaid;
    const newStatus: InvoiceStatus = newBalance <= 0 ? 'paid' : 'partial';

    setInvoices(invoices.map(inv => 
      inv.id === selectedInvoice.id 
        ? { ...inv, amount_paid: newAmountPaid, balance: Math.max(0, newBalance), status: newStatus }
        : inv
    ));

    setIsPaymentOpen(false);
    toast({
      title: 'Payment Recorded',
      description: `Rs. ${paymentData.amount.toLocaleString()} payment recorded successfully`,
    });
  };

  return (
    <div className="min-h-screen">
      <Header title="Invoices" subtitle="Manage billing and payments" />
      
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Outstanding Summary */}
        <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Total Outstanding</p>
              <p className="text-3xl font-bold">Rs. {totalOutstanding.toLocaleString()}</p>
            </div>
            <DollarSign className="h-12 w-12 opacity-20" />
          </CardContent>
        </Card>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice # or patient..."
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
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        {/* Invoices Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Invoice #</TableHead>
                <TableHead className="font-semibold">Patient</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold text-right">Total</TableHead>
                <TableHead className="font-semibold text-right">Paid</TableHead>
                <TableHead className="font-semibold text-right">Balance</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openViewDialog(invoice)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {invoice.status !== 'paid' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openPaymentDialog(invoice)}
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon">
                          <Printer className="h-4 w-4" />
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
                  {mockPatients.filter(p => p.status === 'active').map(patient => (
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
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Select 
                      value={item.description} 
                      onValueChange={(v) => {
                        const treatment = mockTreatmentTypes.find(t => t.name === v);
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
                        {mockTreatmentTypes.map(type => (
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
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Patient</p>
                  <p className="font-medium">{selectedInvoice.patient?.first_name} {selectedInvoice.patient?.last_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{selectedInvoice.invoice_date}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Tooth</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedInvoice.items?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.tooth_number || '-'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">Rs. {item.unit_price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">Rs. {item.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>Rs. {selectedInvoice.subtotal.toLocaleString()}</span>
                </div>
                {selectedInvoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>Discount</span>
                    <span>-Rs. {selectedInvoice.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-2 border-t border-border">
                  <span>Total</span>
                  <span>Rs. {selectedInvoice.total_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>Paid</span>
                  <span>Rs. {selectedInvoice.amount_paid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Balance Due</span>
                  <span className={selectedInvoice.balance > 0 ? 'text-destructive' : ''}>
                    Rs. {selectedInvoice.balance.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                {selectedInvoice.status !== 'paid' && (
                  <Button className="flex-1" onClick={() => { setIsViewOpen(false); openPaymentDialog(selectedInvoice); }}>
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
    </div>
  );
}
