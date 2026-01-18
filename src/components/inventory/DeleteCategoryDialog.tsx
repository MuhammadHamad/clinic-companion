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
import { InventoryCategory } from '@/types';

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: InventoryCategory | null;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
  isDeleting,
  onConfirm,
}: DeleteCategoryDialogProps) {
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
          <AlertDialogTitle>Delete Category</AlertDialogTitle>
          <AlertDialogDescription>
            {category
              ? `Are you sure you want to delete category "${category.name}"? This action cannot be undone.`
              : 'Are you sure you want to delete this category? This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting || !category}
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
