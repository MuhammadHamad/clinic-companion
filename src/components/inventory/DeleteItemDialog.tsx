import { Loader2 } from 'lucide-react';
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
import { InventoryItem } from '@/types';

interface DeleteItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function DeleteItemDialog({
  open,
  onOpenChange,
  item,
  isDeleting,
  onConfirm,
}: DeleteItemDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(openState) => {
        if (isDeleting) return;
        onOpenChange(openState);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Item</AlertDialogTitle>
          <AlertDialogDescription>
            {item
              ? `Are you sure you want to delete "${item.item_name}"? This action cannot be undone.`
              : 'Are you sure you want to delete this item? This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting || !item}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
