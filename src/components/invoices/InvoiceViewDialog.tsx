import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Invoice } from '@/types';
import { cn } from '@/lib/utils';
import { CreditCard, Pencil, Printer, Save, X } from 'lucide-react';

export function InvoiceViewDialog({
  open,
  onOpenChange,
  invoice,
  onUpdatePayment,
  onUpdateDiscount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onUpdatePayment?: (invoice: Invoice) => void;
  onUpdateDiscount?: (invoice: Invoice, discountAmount: number) => Promise<void> | void;
}) {
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [discountDraft, setDiscountDraft] = useState<number>(0);
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);
  const [localInvoice, setLocalInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!open) {
      setIsEditingDiscount(false);
      setIsSavingDiscount(false);
      return;
    }
    setIsEditingDiscount(false);
    setLocalInvoice(invoice);
    setDiscountDraft(invoice?.discount_amount ?? 0);
    setIsSavingDiscount(false);
  }, [open, invoice?.id]);

  const totalsPreview = useMemo(() => {
    if (!localInvoice) return null;
    const nextTotal = localInvoice.subtotal - (discountDraft || 0) + (localInvoice.tax_amount || 0);
    const nextBalance = Math.max(0, nextTotal - (localInvoice.amount_paid || 0));
    return {
      total_amount: nextTotal,
      balance: nextBalance,
    };
  }, [localInvoice, discountDraft]);

  const canUpdatePayment = !!localInvoice && localInvoice.status !== 'paid';
  const canEditDiscount =
    !!localInvoice &&
    (localInvoice.status === 'unpaid' || localInvoice.status === 'partial' || localInvoice.status === 'overdue');

  const handleSaveDiscount = async () => {
    if (!localInvoice || !onUpdateDiscount) return;
    if (!canEditDiscount) return;

    const requested = Math.max(0, Number.isFinite(discountDraft) ? discountDraft : 0);
    const maxDiscountAllowed = Math.max(
      0,
      (localInvoice.subtotal || 0) + (localInvoice.tax_amount || 0) - (localInvoice.amount_paid || 0),
    );
    const sanitized = Math.min(requested, maxDiscountAllowed);

    setIsSavingDiscount(true);
    try {
      await onUpdateDiscount(localInvoice, sanitized);

      const nextTotal = totalsPreview?.total_amount ?? localInvoice.total_amount;
      const nextBalance = totalsPreview?.balance ?? localInvoice.balance;
      const nextStatus = nextBalance <= 0 ? 'paid' : (localInvoice.amount_paid || 0) > 0 ? 'partial' : 'unpaid';

      setLocalInvoice({
        ...localInvoice,
        discount_amount: sanitized,
        total_amount: nextTotal,
        balance: nextBalance,
        status: nextStatus,
      });
      setIsEditingDiscount(false);
    } finally {
      setIsSavingDiscount(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6 border-b border-border">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Invoice {localInvoice?.invoice_number}
          </DialogTitle>
        </DialogHeader>

        {localInvoice && (
          <div className="space-y-8 py-6">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</p>
                <p className="text-lg font-medium text-foreground">
                  {localInvoice.patient?.first_name} {localInvoice.patient?.last_name}
                </p>
              </div>
              <div className="text-right space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</p>
                <p className="text-lg font-medium text-foreground">{localInvoice.invoice_date}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Services & Items</h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">Description</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">Qty</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">Price</TableHead>
                      <TableHead className="text-right font-semibold text-foreground">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localInvoice.items?.map((item, index) => (
                      <TableRow key={index} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-medium text-foreground">{item.description}</TableCell>
                        <TableCell className="text-right text-foreground">{item.quantity}</TableCell>
                        <TableCell className="text-right text-foreground">Rs. {item.unit_price.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-foreground">Rs. {item.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div />
              <div className="space-y-1">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="text-sm font-medium text-foreground">Rs. {localInvoice.subtotal.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Discount</span>
                  {isEditingDiscount ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={discountDraft}
                        onChange={(e) => setDiscountDraft(parseFloat(e.target.value) || 0)}
                        className="w-32 text-right"
                        disabled={isSavingDiscount}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setIsEditingDiscount(false);
                          setDiscountDraft(localInvoice.discount_amount || 0);
                        }}
                        disabled={isSavingDiscount}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('text-sm font-medium', localInvoice.discount_amount > 0 ? 'text-success' : 'text-foreground')}
                      >
                        {localInvoice.discount_amount > 0 ? `-Rs. ${localInvoice.discount_amount.toLocaleString()}` : 'Rs. 0'}
                      </span>
                      {onUpdateDiscount && canEditDiscount && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setIsEditingDiscount(true)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between py-3 border-t border-border">
                  <span className="text-base font-semibold text-foreground">Total</span>
                  <span className="text-base font-bold text-foreground">
                    Rs. {(isEditingDiscount ? totalsPreview?.total_amount ?? localInvoice.total_amount : localInvoice.total_amount).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between py-2">
                  <span className="text-sm text-muted-foreground">Paid</span>
                  <span className="text-sm font-medium text-success">Rs. {localInvoice.amount_paid.toLocaleString()}</span>
                </div>

                <div className="flex justify-between py-3 border-t border-border">
                  <span className="text-lg font-bold text-foreground">Balance Due</span>
                  <span
                    className={cn(
                      'text-lg font-bold',
                      (isEditingDiscount ? totalsPreview?.balance ?? localInvoice.balance : localInvoice.balance) > 0
                        ? 'text-destructive'
                        : 'text-success',
                    )}
                  >
                    Rs. {(isEditingDiscount ? totalsPreview?.balance ?? localInvoice.balance : localInvoice.balance).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-border">
              {isEditingDiscount ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11"
                    onClick={() => {
                      setIsEditingDiscount(false);
                      setDiscountDraft(localInvoice.discount_amount || 0);
                    }}
                    disabled={isSavingDiscount}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 h-11"
                    onClick={handleSaveDiscount}
                    disabled={isSavingDiscount}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Discount
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="flex-1 h-11">
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  {canUpdatePayment && onUpdatePayment && (
                    <Button className="flex-1 h-11" onClick={() => onUpdatePayment(localInvoice)}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Update Payment
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
