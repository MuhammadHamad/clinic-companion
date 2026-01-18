import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InventoryCategory } from '@/types';

interface CategoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: InventoryCategory[];
  editingCategory: InventoryCategory | null;
  categoryName: string;
  categoryDescription: string;
  onCategoryNameChange: (name: string) => void;
  onCategoryDescriptionChange: (description: string) => void;
  onEditCategory: (category: InventoryCategory) => void;
  onDeleteCategory: (category: InventoryCategory) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function CategoryManagementDialog({
  open,
  onOpenChange,
  categories,
  editingCategory,
  categoryName,
  categoryDescription,
  onCategoryNameChange,
  onCategoryDescriptionChange,
  onEditCategory,
  onDeleteCategory,
  onSubmit,
  onCancel,
  isSubmitting,
}: CategoryManagementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
          <DialogDescription>
            Create new inventory categories for your clinic
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {categories.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Existing Categories</h4>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditCategory(cat)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteCategory(cat)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </h4>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="form-label">Category Name *</label>
                <Input
                  value={categoryName}
                  onChange={(e) => onCategoryNameChange(e.target.value)}
                  placeholder="e.g., Instruments, Materials, Consumables"
                  required
                />
              </div>
              <div>
                <label className="form-label">Description</label>
                <Textarea
                  value={categoryDescription}
                  onChange={(e) => onCategoryDescriptionChange(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>
            </form>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={onSubmit}
            disabled={!categoryName.trim() || isSubmitting}
          >
            {isSubmitting
              ? editingCategory
                ? 'Updating...'
                : 'Creating...'
              : editingCategory
              ? 'Update Category'
              : 'Create Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
