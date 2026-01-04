import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, InvoiceItem, InvoiceStatus, Patient, PaymentMethod } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const mapRowToInvoice = (inv: any): Invoice => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    patient_id: inv.patient_id,
    invoice_date: inv.invoice_date,
    due_date: inv.due_date,
    subtotal: Number(inv.subtotal),
    discount_amount: Number(inv.discount_amount),
    tax_amount: Number(inv.tax_amount),
    total_amount: Number(inv.total_amount),
    amount_paid: Number(inv.amount_paid),
    balance: Number(inv.balance),
    status: inv.status as InvoiceStatus,
    payment_terms: inv.payment_terms,
    notes: inv.notes,
    created_at: inv.created_at,
    patient: inv.patient
      ? ({
          id: inv.patient.id,
          patient_number: inv.patient.patient_number,
          first_name: inv.patient.first_name,
          last_name: inv.patient.last_name,
          phone: inv.patient.phone,
          email: inv.patient.email,
          status: inv.patient.status as 'active' | 'inactive',
          registration_date: inv.patient.registration_date,
          created_at: inv.patient.created_at,
        } as Patient)
      : undefined,
    items: (inv.items || []).map((item: any) => ({
      id: item.id,
      invoice_id: item.invoice_id,
      description: item.description,
      tooth_number: item.tooth_number,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      total: Number(item.total),
    })),
  });

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          patient:patients(*),
          items:invoice_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInvoices((data || []).map(mapRowToInvoice));
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch invoices',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createInvoice = async (invoiceData: {
    patient_id: string;
    items: Omit<InvoiceItem, 'id' | 'invoice_id'>[];
    discount_amount: number;
    tax_amount: number;
    payment_terms?: string;
    notes?: string;
  }) => {
    try {
      const subtotal = invoiceData.items.reduce((sum, item) => sum + item.total, 0);
      const total_amount = subtotal - invoiceData.discount_amount + invoiceData.tax_amount;

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          patient_id: invoiceData.patient_id,
          subtotal,
          discount_amount: invoiceData.discount_amount,
          tax_amount: invoiceData.tax_amount,
          total_amount,
          amount_paid: 0,
          balance: total_amount,
          status: 'unpaid',
          payment_terms: invoiceData.payment_terms || null,
          notes: invoiceData.notes || null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert invoice items
      const itemsToInsert = invoiceData.items
        .filter(item => item.description)
        .map(item => ({
          invoice_id: invoice.id,
          description: item.description,
          tooth_number: item.tooth_number || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      const { data: invoiceWithJoins, error: invoiceFetchError } = await supabase
        .from('invoices')
        .select(`
          *,
          patient:patients(*),
          items:invoice_items(*)
        `)
        .eq('id', invoice.id)
        .single();

      if (invoiceFetchError) throw invoiceFetchError;

      setInvoices((prev) => [mapRowToInvoice(invoiceWithJoins), ...prev]);
      return { success: true, data: invoiceWithJoins };
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      return { success: false, error: error.message };
    }
  };

  const recordPayment = async (invoiceId: string, paymentData: {
    amount: number;
    payment_method: PaymentMethod;
    reference_number?: string;
    notes?: string;
  }) => {
    try {
      const invoice = invoices.find(i => i.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found');

      const paymentDate = new Date().toISOString().split('T')[0];

      // Insert payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          invoice_id: invoiceId,
          patient_id: invoice.patient_id,
          payment_date: paymentDate,
          amount: paymentData.amount,
          payment_method: paymentData.payment_method,
          reference_number: paymentData.reference_number || null,
          notes: paymentData.notes || null,
        });

      if (paymentError) throw paymentError;

      // Update invoice
      const newAmountPaid = invoice.amount_paid + paymentData.amount;
      const newBalance = invoice.total_amount - newAmountPaid;
      const newStatus: InvoiceStatus = newBalance <= 0 ? 'paid' : 'partial';

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          balance: Math.max(0, newBalance),
          status: newStatus,
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // Optimistically update local state instead of re-fetching all invoices
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                amount_paid: newAmountPaid,
                balance: Math.max(0, newBalance),
                status: newStatus,
              }
            : inv,
        ),
      );

      return { success: true };
    } catch (error: any) {
      console.error('Error recording payment:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete invoice',
        variant: 'destructive',
      });
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return {
    invoices,
    isLoading,
    fetchInvoices,
    createInvoice,
    recordPayment,
    deleteInvoice,
  };
}
