import { Loader2 } from 'lucide-react';
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
import { InventoryItem, MovementType } from '@/types';

export interface StockMovementFormData {
  item_id: string;
  movement_type: MovementType | '';
  quantity: number;
  unit_cost: number;
  reference_number: string;
  notes: string;
}

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: StockMovementFormData;
  onFormDataChange: (data: StockMovementFormData) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  items: InventoryItem[];
  selectedItem?: InventoryItem | null;
}

export function StockMovementDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSubmit,
  isSubmitting,
  items,
  selectedItem,
}: StockMovementDialogProps) {
  const handleChange = (field: keyof StockMovementFormData, value: string | number) => {
    onFormDataChange({ ...formData, [field]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Stock Movement</DialogTitle>
          <DialogDescription>
            {selectedItem
              ? `Recording movement for ${selectedItem.item_name}`
              : 'Select an item and record stock movement'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="form-label">Item *</label>
              <Select
                value={formData.item_id}
                onValueChange={(v) => handleChange('item_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.item_name} ({item.current_quantity} {item.unit_of_measure || 'units'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="form-label">Movement Type *</label>
              <Select
                value={formData.movement_type}
                onValueChange={(v) => handleChange('movement_type', v as MovementType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_in">Stock In (Purchase/Restock)</SelectItem>
                  <SelectItem value="stock_out">Stock Out (Usage/Sale)</SelectItem>
                  <SelectItem value="adjustment">Adjustment (Correction)</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="damage">Damage/Waste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="form-label">Quantity *</label>
              <Input
                type="number"
                min="1"
                value={formData.quantity || ''}
                onChange={(e) => handleChange('quantity', Number(e.target.value))}
                required
              />
            </div>
            {formData.movement_type === 'stock_in' && (
              <div>
                <label className="form-label">Unit Cost (Rs.)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unit_cost || ''}
                  onChange={(e) => handleChange('unit_cost', Number(e.target.value))}
                />
              </div>
            )}
            <div>
              <label className="form-label">Reference #</label>
              <Input
                value={formData.reference_number}
                onChange={(e) => handleChange('reference_number', e.target.value)}
                placeholder="Invoice/PO number"
              />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Additional notes"
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
            <Button type="submit" disabled={isSubmitting || !formData.item_id || !formData.movement_type}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Movement'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
