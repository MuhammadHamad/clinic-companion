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
import { InventoryCategory, InventoryStatus } from '@/types';

export interface InventoryItemFormData {
  item_name: string;
  item_code: string;
  category_id: string;
  unit_of_measure: string;
  current_quantity: number;
  minimum_threshold: number;
  unit_cost: number;
  supplier_name: string;
  supplier_contact: string;
  expiry_date: string;
  status: InventoryStatus;
}

interface InventoryItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  formData: InventoryItemFormData;
  onFormDataChange: (data: InventoryItemFormData) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  categories: InventoryCategory[];
}

export function InventoryItemFormDialog({
  open,
  onOpenChange,
  mode,
  formData,
  onFormDataChange,
  onSubmit,
  isSubmitting,
  categories,
}: InventoryItemFormDialogProps) {
  const handleChange = (field: keyof InventoryItemFormData, value: string | number) => {
    onFormDataChange({ ...formData, [field]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Item' : 'Edit Item'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Enter item details below'
              : `Editing ${formData.item_name}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Item Name *</label>
              <Input
                value={formData.item_name}
                onChange={(e) => handleChange('item_name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="form-label">Item Code</label>
              <Input
                value={formData.item_code}
                onChange={(e) => handleChange('item_code', e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div>
              <label className="form-label">Category</label>
              <Select
                value={formData.category_id}
                onValueChange={(v) => handleChange('category_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="form-label">Unit of Measure</label>
              <Input
                value={formData.unit_of_measure}
                onChange={(e) => handleChange('unit_of_measure', e.target.value)}
                placeholder="e.g., pcs, boxes, ml"
              />
            </div>
            <div>
              <label className="form-label">Current Quantity *</label>
              <Input
                type="number"
                min="0"
                value={formData.current_quantity}
                onChange={(e) => handleChange('current_quantity', Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="form-label">Minimum Threshold</label>
              <Input
                type="number"
                min="0"
                value={formData.minimum_threshold}
                onChange={(e) => handleChange('minimum_threshold', Number(e.target.value))}
              />
            </div>
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
            <div>
              <label className="form-label">Expiry Date</label>
              <Input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => handleChange('expiry_date', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Supplier Name</label>
              <Input
                value={formData.supplier_name}
                onChange={(e) => handleChange('supplier_name', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Supplier Contact</label>
              <Input
                value={formData.supplier_contact}
                onChange={(e) => handleChange('supplier_contact', e.target.value)}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === 'create' ? 'Creating...' : 'Saving...'}
                </>
              ) : mode === 'create' ? (
                'Create Item'
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
