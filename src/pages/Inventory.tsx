import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Card, CardContent } from '@/components/ui/card';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Search, 
  Pencil,
  Package,
  AlertTriangle,
  Filter,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Trash2,
  List,
} from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import { InventoryItem, InventoryCategory, InventoryStatus, MovementType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLocation } from 'react-router-dom';

const statusColors: Record<InventoryStatus, string> = {
  in_stock: 'bg-success/10 text-success border-success/20',
  low_stock: 'bg-warning/10 text-warning border-warning/20',
  out_of_stock: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabels: Record<InventoryStatus, string> = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

export default function Inventory() {
  const { items, categories, isLoading, fetchItems, createItem, updateItem, recordMovement, deleteItem, createCategory, updateCategory, deleteCategory } = useInventory();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const [duplicateItemWarningKey, setDuplicateItemWarningKey] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateItemInfo, setDuplicateItemInfo] = useState<InventoryItem | null>(null);

  // Category management state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  
  // Category edit/delete state
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [isDeleteCategoryOpen, setIsDeleteCategoryOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<InventoryCategory | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  const [formData, setFormData] = useState({
    item_name: '',
    category_id: '',
    unit_of_measure: '',
    current_quantity: 0,
    minimum_threshold: 0,
    unit_cost: 0,
    supplier_name: '',
    supplier_contact: '',
    expiry_date: '',
  });

  const [movementData, setMovementData] = useState({
    movement_type: '' as MovementType | '',
    quantity: 0,
    unit_cost: 0,
    notes: '',
  });

  const stats = {
    total: items.length,
    low_stock: items.filter(i => i.status === 'low_stock').length,
    out_of_stock: items.filter(i => i.status === 'out_of_stock').length,
    total_value: items.reduce((sum, i) => sum + (i.current_quantity * (i.unit_cost || 0)), 0),
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Pagination calculations
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const currentPageItems = filteredItems.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q && q !== searchQuery) setSearchQuery(q);
  }, [location.search, searchQuery]);

  const generateItemCode = () => {
    try {
      // Prefer UUID when available
      const uuid = (globalThis as any).crypto?.randomUUID?.();
      if (uuid) return `ITM-${uuid}`;
    } catch {
      // ignore
    }
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const ts = Date.now().toString(36).toUpperCase();
    return `ITM-${ts}-${rand}`;
  };

  const openCreateForm = () => {
    setFormMode('create');
    setFormData({
      item_name: '',
      category_id: '',
      unit_of_measure: '',
      current_quantity: 0,
      minimum_threshold: 0,
      unit_cost: 0,
      supplier_name: '',
      supplier_contact: '',
      expiry_date: '',
    });
    setDuplicateItemWarningKey(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setFormMode('edit');
    setSelectedItem(item);
    setFormData({
      item_name: item.item_name,
      category_id: item.category_id || '',
      unit_of_measure: item.unit_of_measure,
      current_quantity: item.current_quantity,
      minimum_threshold: item.minimum_threshold,
      unit_cost: item.unit_cost || 0,
      supplier_name: item.supplier_name || '',
      supplier_contact: item.supplier_contact || '',
      expiry_date: item.expiry_date || '',
    });
    setDuplicateItemWarningKey(null);
    setIsFormOpen(true);
  };

  const openMovementDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setMovementData({
      movement_type: '',
      quantity: 0,
      unit_cost: item.unit_cost || 0,
      notes: '',
    });
    setIsMovementOpen(true);
  };

  const getStatus = (qty: number, threshold: number): InventoryStatus => {
    if (qty <= 0) return 'out_of_stock';
    if (qty <= threshold) return 'low_stock';
    return 'in_stock';
  };

  const submitInventoryForm = async () => {
    const result = formMode === 'create'
      ? await createItem(formData)
      : await updateItem(selectedItem!.id, formData);

    if (result.success) {
      setIsFormOpen(false);
      toast({
        title: formMode === 'create' ? 'Item Added' : 'Item Updated',
        description: formMode === 'create'
          ? `${formData.item_name} has been added to inventory`
          : 'Inventory item has been updated successfully',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitLockRef.current) return;
    submitLockRef.current = true;

    if (isSubmitting) {
      submitLockRef.current = false;
      return;
    }
    
    if (!formData.item_name || !formData.unit_of_measure || !formData.category_id) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      submitLockRef.current = false;
      return;
    }

    if (formMode === 'create') {
      const key = `${formData.item_name.trim().toLowerCase()}|${formData.category_id}|${formData.unit_of_measure}`;
      const existing = items.find(
        (i) =>
          i.item_name.trim().toLowerCase() === formData.item_name.trim().toLowerCase() &&
          i.category_id === formData.category_id &&
          i.unit_of_measure === formData.unit_of_measure
      );

      if (existing && duplicateItemWarningKey !== key) {
        setDuplicateItemWarningKey(key);
        setDuplicateItemInfo(existing);
        setDuplicateModalOpen(true);
        setIsSubmitting(false);
        submitLockRef.current = false;
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await submitInventoryForm();
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const openDeleteDialog = (item: InventoryItem) => {
    setItemToDelete(item);
    setIsDeleteOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    const result = await deleteItem(itemToDelete.id);

    if (result.success) {
      toast({
        title: 'Item deleted',
        description: 'The inventory item has been removed successfully.',
      });
      setIsDeleteOpen(false);
      setItemToDelete(null);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete item',
        variant: 'destructive',
      });
    }

    setIsDeleting(false);
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateModalOpen(false);
    setDuplicateItemInfo(null);
    setDuplicateItemWarningKey(null);
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await submitInventoryForm();
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateModalOpen(false);
    setDuplicateItemInfo(null);
    setDuplicateItemWarningKey(null);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCategoryName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingCategory(true);
    
    const result = await createCategory(newCategoryName.trim(), newCategoryDescription.trim() || undefined);
    
    if (result.success) {
      toast({
        title: 'Category Created',
        description: `${newCategoryName} has been added successfully`,
      });
      setNewCategoryName('');
      setNewCategoryDescription('');
      setIsCategoryDialogOpen(false);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create category',
        variant: 'destructive',
      });
    }
    
    setIsCreatingCategory(false);
  };

  const openEditCategory = (category: InventoryCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryDescription(category.description || '');
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingCategory || !newCategoryName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingCategory(true);
    
    const result = await updateCategory(editingCategory.id, newCategoryName.trim(), newCategoryDescription.trim() || undefined);
    
    if (result.success) {
      toast({
        title: 'Category Updated',
        description: `${newCategoryName} has been updated successfully`,
      });
      setEditingCategory(null);
      setNewCategoryName('');
      setNewCategoryDescription('');
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update category',
        variant: 'destructive',
      });
    }
    
    setIsCreatingCategory(false);
  };

  const openDeleteCategoryDialog = (category: InventoryCategory) => {
    setCategoryToDelete(category);
    setIsDeleteCategoryOpen(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);

    const result = await deleteCategory(categoryToDelete.id);

    if (result.success) {
      toast({
        title: 'Category Deleted',
        description: `${categoryToDelete.name} has been removed successfully`,
      });
      setIsDeleteCategoryOpen(false);
      setCategoryToDelete(null);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete category',
        variant: 'destructive',
      });
    }

    setIsDeletingCategory(false);
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!movementData.movement_type || movementData.quantity <= 0 || !selectedItem) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid quantity and movement type',
        variant: 'destructive',
      });
      return;
    }

    const result = await recordMovement(selectedItem.id, {
      ...movementData,
      movement_type: movementData.movement_type as MovementType,
    });

    if (result.success) {
      setIsMovementOpen(false);
      toast({
        title: 'Stock Updated',
        description: `${selectedItem.item_name} quantity updated`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Inventory" subtitle="Manage your stock and supplies" />
      
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.low_stock > 0 ? 'border-warning/50' : ''}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-xl font-bold text-warning">{stats.low_stock}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.out_of_stock > 0 ? 'border-destructive/50' : ''}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-xl font-bold text-destructive">{stats.out_of_stock}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold">Rs. {stats.total_value.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1 flex-wrap">
            <div className="relative flex-1 max-w-md min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
              <List className="h-4 w-4 mr-2" />
              Manage Categories
            </Button>
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold text-center w-16">#</TableHead>
                <TableHead className="font-semibold">Item Name</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold text-center">Current Qty</TableHead>
                <TableHead className="font-semibold text-center">Min Threshold</TableHead>
                <TableHead className="font-semibold text-right">Unit Cost</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    {totalItems === 0 ? (
                      categories.length === 0 ? (
                        <div className="space-y-4">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                          <div>
                            <h3 className="font-semibold text-lg">No categories found</h3>
                            <p className="text-muted-foreground mb-2">
                              Create your first category to start organizing inventory items
                            </p>
                            <p className="text-sm text-muted-foreground mb-4">
                              Examples: Instruments, Materials, Consumables, Medications, Equipment
                            </p>
                            <Button 
                              onClick={() => setIsCategoryDialogOpen(true)}
                              className="mx-auto"
                            >
                              <List className="h-4 w-4 mr-2" />
                              Create Your First Category
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                          <div>
                            <h3 className="font-semibold text-lg">No items found</h3>
                            <p className="text-muted-foreground">
                              Get started by adding your first inventory item
                            </p>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground" />
                        <div>
                          <h3 className="font-semibold text-lg">No items on this page</h3>
                          <p className="text-muted-foreground">
                            Try adjusting your filters or go to a different page
                          </p>
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                currentPageItems.map((item, index) => (
                  <TableRow key={item.id} className="data-table-row">
                    <TableCell className="text-center text-muted-foreground font-medium">
                      {startIndex + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-sm text-muted-foreground">{item.unit_of_measure}</div>
                    </TableCell>
                    <TableCell>{item.category?.name || '-'}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        'font-medium',
                        item.status === 'out_of_stock' && 'text-destructive',
                        item.status === 'low_stock' && 'text-warning'
                      )}>
                        {item.current_quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{item.minimum_threshold}</TableCell>
                    <TableCell className="text-right">
                      {item.unit_cost ? `Rs. ${item.unit_cost.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(statusColors[item.status])}>
                        {statusLabels[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openMovementDialog(item)}
                          title="Stock Movement"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(item)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalItems > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Create/Edit Item Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Add Inventory Item' : 'Edit Item'}</DialogTitle>
            <DialogDescription>
              {formMode === 'create' ? 'Add a new item to your inventory' : 'Update item details'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="form-label">Item Name *</label>
                <Input
                  value={formData.item_name}
                  onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                  placeholder="Enter item name"
                  required
                />
              </div>
              <div>
                <label className="form-label">Category *</label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({...formData, category_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder={categories.length === 0 ? "No categories available" : "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <div className="p-2 text-center">
                        <p className="text-sm text-muted-foreground mb-2">No categories found</p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            setIsCategoryDialogOpen(true);
                          }}
                        >
                          Create Category
                        </Button>
                      </div>
                    ) : (
                      categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="form-label">Unit of Measure *</label>
                <Select value={formData.unit_of_measure} onValueChange={(v) => setFormData({...formData, unit_of_measure: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pieces">Pieces</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                    <SelectItem value="pack">Pack</SelectItem>
                    <SelectItem value="syringe">Syringe</SelectItem>
                    <SelectItem value="kit">Kit</SelectItem>
                    <SelectItem value="strip">Strip</SelectItem>
                    <SelectItem value="bottle">Bottle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="form-label">Current Quantity *</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.current_quantity}
                  onChange={(e) => setFormData({...formData, current_quantity: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>
              <div>
                <label className="form-label">Min Threshold *</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.minimum_threshold}
                  onChange={(e) => setFormData({...formData, minimum_threshold: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>
              <div>
                <label className="form-label">Unit Cost (Rs.)</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({...formData, unit_cost: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div>
                <label className="form-label">Supplier Name</label>
                <Input
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="form-label">Supplier Contact</label>
                <Input
                  value={formData.supplier_contact}
                  onChange={(e) => setFormData({...formData, supplier_contact: e.target.value})}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="form-label">Expiry Date</label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : (formMode === 'create' ? 'Add Item' : 'Save Changes')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={isMovementOpen} onOpenChange={setIsMovementOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock Movement</DialogTitle>
            <DialogDescription>
              {selectedItem?.item_name} • Current: {selectedItem?.current_quantity} {selectedItem?.unit_of_measure}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleMovement} className="space-y-4">
            <div>
              <label className="form-label">Movement Type *</label>
              <Select value={movementData.movement_type} onValueChange={(v) => setMovementData({...movementData, movement_type: v as MovementType})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_in">
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-success" />
                      Stock In
                    </div>
                  </SelectItem>
                  <SelectItem value="stock_out">
                    <div className="flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-destructive" />
                      Stock Out
                    </div>
                  </SelectItem>
                  <SelectItem value="adjustment">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      Adjustment
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="form-label">
                {movementData.movement_type === 'adjustment' ? 'New Quantity *' : 'Quantity *'}
              </label>
              <Input
                type="number"
                min="0"
                value={movementData.quantity}
                onChange={(e) => setMovementData({...movementData, quantity: parseFloat(e.target.value) || 0})}
                required
              />
            </div>

            {movementData.movement_type === 'stock_in' && (
              <div>
                <label className="form-label">Unit Cost (Rs.)</label>
                <Input
                  type="number"
                  min="0"
                  value={movementData.unit_cost}
                  onChange={(e) => setMovementData({...movementData, unit_cost: parseFloat(e.target.value) || 0})}
                />
              </div>
            )}

            {selectedItem && movementData.quantity > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Preview</p>
                <p className="font-medium">
                  {selectedItem.current_quantity} 
                  {movementData.movement_type === 'stock_in' && ` + ${movementData.quantity}`}
                  {movementData.movement_type === 'stock_out' && ` - ${movementData.quantity}`}
                  {movementData.movement_type === 'adjustment' && ` → ${movementData.quantity}`}
                  {' = '}
                  <span className="text-primary">
                    {movementData.movement_type === 'stock_in' 
                      ? selectedItem.current_quantity + movementData.quantity
                      : movementData.movement_type === 'stock_out'
                        ? Math.max(0, selectedItem.current_quantity - movementData.quantity)
                        : movementData.quantity
                    }
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="form-label">Notes</label>
              <Textarea
                value={movementData.notes}
                onChange={(e) => setMovementData({...movementData, notes: e.target.value})}
                placeholder="Reason for movement"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsMovementOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setIsDeleteOpen(open);
          if (!open) setItemToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete
                ? `Are you sure you want to delete item ${itemToDelete.item_name}? This action cannot be undone.`
                : 'Are you sure you want to delete this item? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting || !itemToDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteItem();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Management Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
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
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex-1">
                        <span className="text-sm font-medium">{cat.name}</span>
                        {cat.description && (
                          <p className="text-xs text-muted-foreground">{cat.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditCategory(cat)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteCategoryDialog(cat)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
              <form onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory} className="space-y-3">
                <div>
                  <label className="form-label">Category Name *</label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Instruments, Materials, Consumables"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <Textarea
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={2}
                  />
                </div>
              </form>
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsCategoryDialogOpen(false);
                setEditingCategory(null);
                setNewCategoryName('');
                setNewCategoryDescription('');
              }}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
              disabled={!newCategoryName.trim() || isCreatingCategory}
            >
              {isCreatingCategory 
                ? (editingCategory ? 'Updating...' : 'Creating...')
                : (editingCategory ? 'Update Category' : 'Create Category')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteCategoryOpen}
        onOpenChange={(open) => {
          if (isDeletingCategory) return;
          setIsDeleteCategoryOpen(open);
          if (!open) setCategoryToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category</AlertDialogTitle>
            <AlertDialogDescription>
              {categoryToDelete
                ? `Are you sure you want to delete category "${categoryToDelete.name}"? This action cannot be undone.`
                : 'Are you sure you want to delete this category? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCategory}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingCategory || !categoryToDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteCategory();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Item Confirmation Modal */}
      <Dialog
        open={duplicateModalOpen}
        onOpenChange={(open) => {
          setDuplicateModalOpen(open);
          if (!open) {
            setDuplicateItemInfo(null);
            setDuplicateItemWarningKey(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Possible Duplicate Item</DialogTitle>
            <DialogDescription>
              An item with the same name, category, and unit of measure already exists.
            </DialogDescription>
          </DialogHeader>
          
          {duplicateItemInfo && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">Existing Item:</h4>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Name:</span> {duplicateItemInfo.item_name}</div>
                <div><span className="font-medium">Category:</span> {duplicateItemInfo.category?.name || '-'}</div>
                <div><span className="font-medium">Unit:</span> {duplicateItemInfo.unit_of_measure}</div>
                <div><span className="font-medium">Current Quantity:</span> {duplicateItemInfo.current_quantity}</div>
                {duplicateItemInfo.unit_cost && (
                  <div><span className="font-medium">Unit Cost:</span> Rs. {duplicateItemInfo.unit_cost.toLocaleString()}</div>
                )}
              </div>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            If this represents the same product, consider updating its quantity instead of creating a new item.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleDuplicateCancel}>
              Cancel
            </Button>
            <Button onClick={handleDuplicateConfirm}>
              Create Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
