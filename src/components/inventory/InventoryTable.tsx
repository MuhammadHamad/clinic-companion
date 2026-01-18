import { Pencil, ArrowUpCircle, ArrowDownCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InventoryItem, InventoryStatus } from '@/types';
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

interface InventoryTableProps {
  items: InventoryItem[];
  totalItems: number;
  onEdit: (item: InventoryItem) => void;
  onStockIn: (item: InventoryItem) => void;
  onStockOut: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}

export function InventoryTable({
  items,
  totalItems,
  onEdit,
  onStockIn,
  onStockOut,
  onDelete,
}: InventoryTableProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold whitespace-nowrap">Item Name</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Category</TableHead>
              <TableHead className="font-semibold text-right whitespace-nowrap">Quantity</TableHead>
              <TableHead className="font-semibold text-right whitespace-nowrap">Unit Cost</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Status</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Supplier</TableHead>
              <TableHead className="font-semibold text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {totalItems === 0 ? 'No items found' : 'No items on this page'}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="data-table-row">
                  <TableCell>
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-sm text-muted-foreground">{item.item_code}</div>
                  </TableCell>
                  <TableCell>{item.category?.name || '-'}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        'font-medium',
                        item.status === 'out_of_stock' && 'text-destructive',
                        item.status === 'low_stock' && 'text-warning'
                      )}
                    >
                      {item.current_quantity}
                    </span>
                    <span className="text-muted-foreground ml-1">{item.unit_of_measure}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.unit_cost ? `Rs. ${item.unit_cost.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('border', statusColors[item.status])}>
                      {statusLabels[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.supplier_name || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                            <Pencil className="h-4 w-4" />
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
                            className="text-success hover:text-success"
                            onClick={() => onStockIn(item)}
                          >
                            <ArrowUpCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Stock In</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-warning hover:text-warning"
                            onClick={() => onStockOut(item)}
                          >
                            <ArrowDownCircle className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Stock Out</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => onDelete(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
