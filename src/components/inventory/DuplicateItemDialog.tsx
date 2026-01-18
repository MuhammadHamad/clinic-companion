import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InventoryItem } from '@/types';

interface DuplicateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateItem: InventoryItem | null;
  onViewExisting: () => void;
  onCreateAnyway: () => void;
}

export function DuplicateItemDialog({
  open,
  onOpenChange,
  duplicateItem,
  onViewExisting,
  onCreateAnyway,
}: DuplicateItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Possible Duplicate Item</DialogTitle>
          <DialogDescription>
            An item with this name already exists in the inventory.
          </DialogDescription>
        </DialogHeader>

        {duplicateItem && (
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="font-medium">{duplicateItem.item_name}</p>
            <p className="text-sm text-muted-foreground">{duplicateItem.item_code}</p>
            <p className="text-sm text-muted-foreground">
              Category: {duplicateItem.category?.name || '-'}
            </p>
            <p className="text-sm text-muted-foreground">
              Quantity: {duplicateItem.current_quantity} {duplicateItem.unit_of_measure}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onViewExisting}>
            View Existing
          </Button>
          <Button onClick={onCreateAnyway}>Create Anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
