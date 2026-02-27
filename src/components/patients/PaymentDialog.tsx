import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Invoice, PaymentMethod } from '@/types';

export interface PaymentFormData {
  amount: number;
  payment_method: PaymentMethod | '';
  reference_number: string;
  notes: string;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  formData: PaymentFormData;
  onFormDataChange: (data: PaymentFormData) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting?: boolean;
}

export function PaymentDialog({
  open,
  onOpenChange,
  invoice,
  formData,
  onFormDataChange,
  onSubmit,
  isSubmitting = false,
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Payment</DialogTitle>
          <DialogDescription>
            {invoice
              ? `Invoice ${invoice.invoice_number} (Balance: Rs. ${invoice.balance.toLocaleString()})`
              : 'Select invoice'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Amount *</label>
              <Input
                type="number"
                min="0"
                value={formData.amount || ''}
                onChange={(e) =>
                  onFormDataChange({
                    ...formData,
                    amount: e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </div>
            <div className="col-span-2">
              <label className="form-label">Payment Method *</label>
              <Select
                value={formData.payment_method}
                onValueChange={(v) =>
                  onFormDataChange({ ...formData, payment_method: v as PaymentMethod })
                }
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
                value={formData.reference_number}
                onChange={(e) =>
                  onFormDataChange({ ...formData, reference_number: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
            <div className="col-span-2">
              <label className="form-label">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  onFormDataChange({ ...formData, notes: e.target.value })
                }
                placeholder="Optional"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!invoice || isSubmitting}>
              Save Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
