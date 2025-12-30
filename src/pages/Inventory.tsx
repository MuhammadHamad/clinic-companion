import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Plus, 
  Search, 
  Pencil,
  Package,
  AlertTriangle,
  Filter,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
} from 'lucide-react';
import { mockInventoryItems, mockInventoryCategories } from '@/data/mockData';
import { InventoryItem, InventoryStatus, MovementType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const [items, setItems] = useState<InventoryItem[]>(mockInventoryItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    item_name: '',
    item_code: '',
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
    const matchesSearch = 
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_code?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const openCreateForm = () => {
    setFormMode('create');
    setFormData({
      item_name: '',
      item_code: `ITM-${String(items.length + 1).padStart(3, '0')}`,
      category_id: '',
      unit_of_measure: '',
      current_quantity: 0,
      minimum_threshold: 0,
      unit_cost: 0,
      supplier_name: '',
      supplier_contact: '',
      expiry_date: '',
    });
    setIsFormOpen(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setFormMode('edit');
    setSelectedItem(item);
    setFormData({
      item_name: item.item_name,
      item_code: item.item_code || '',
      category_id: item.category_id || '',
      unit_of_measure: item.unit_of_measure,
      current_quantity: item.current_quantity,
      minimum_threshold: item.minimum_threshold,
      unit_cost: item.unit_cost || 0,
      supplier_name: item.supplier_name || '',
      supplier_contact: item.supplier_contact || '',
      expiry_date: item.expiry_date || '',
    });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.item_name || !formData.unit_of_measure || !formData.category_id) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const status = getStatus(formData.current_quantity, formData.minimum_threshold);
    const category = mockInventoryCategories.find(c => c.id === formData.category_id);

    if (formMode === 'create') {
      const newItem: InventoryItem = {
        id: String(Date.now()),
        ...formData,
        status,
        created_at: new Date().toISOString(),
        category,
      };
      setItems([newItem, ...items]);
      toast({
        title: 'Item Added',
        description: `${formData.item_name} has been added to inventory`,
      });
    } else if (selectedItem) {
      setItems(items.map(i => 
        i.id === selectedItem.id 
          ? { ...i, ...formData, status, category }
          : i
      ));
      toast({
        title: 'Item Updated',
        description: 'Inventory item has been updated successfully',
      });
    }

    setIsFormOpen(false);
  };

  const handleMovement = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!movementData.movement_type || movementData.quantity <= 0 || !selectedItem) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid quantity and movement type',
        variant: 'destructive',
      });
      return;
    }

    let newQuantity = selectedItem.current_quantity;
    
    switch (movementData.movement_type) {
      case 'stock_in':
        newQuantity += movementData.quantity;
        break;
      case 'stock_out':
        newQuantity -= movementData.quantity;
        if (newQuantity < 0) {
          toast({
            title: 'Error',
            description: 'Cannot remove more than available quantity',
            variant: 'destructive',
          });
          return;
        }
        break;
      case 'adjustment':
        newQuantity = movementData.quantity;
        break;
    }

    const newStatus = getStatus(newQuantity, selectedItem.minimum_threshold);

    setItems(items.map(i => 
      i.id === selectedItem.id 
        ? { ...i, current_quantity: newQuantity, status: newStatus, unit_cost: movementData.unit_cost }
        : i
    ));

    setIsMovementOpen(false);
    toast({
      title: 'Stock Updated',
      description: `${selectedItem.item_name} quantity updated to ${newQuantity}`,
    });
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
                {mockInventoryCategories.map(cat => (
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
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        {/* Items Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Item Code</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold text-center">Current Qty</TableHead>
                <TableHead className="font-semibold text-center">Min Threshold</TableHead>
                <TableHead className="font-semibold text-right">Unit Cost</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No items found
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="data-table-row">
                    <TableCell className="font-medium text-primary">{item.item_code}</TableCell>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
                <label className="form-label">Item Code</label>
                <Input
                  value={formData.item_code}
                  onChange={(e) => setFormData({...formData, item_code: e.target.value})}
                  placeholder="ITM-001"
                />
              </div>
              <div>
                <label className="form-label">Category *</label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({...formData, category_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockInventoryCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
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
              <Button type="submit">
                {formMode === 'create' ? 'Add Item' : 'Save Changes'}
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
    </div>
  );
}
