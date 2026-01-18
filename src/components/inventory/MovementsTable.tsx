import { ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StockMovement, MovementType } from '@/types';
import { cn } from '@/lib/utils';

const movementTypeLabels: Record<MovementType, string> = {
  stock_in: 'Stock In',
  stock_out: 'Stock Out',
  adjustment: 'Adjustment',
};

const movementTypeColors: Record<MovementType, string> = {
  stock_in: 'text-success',
  stock_out: 'text-warning',
  adjustment: 'text-primary',
};

interface MovementsTableProps {
  movements: StockMovement[];
  maxRows?: number;
}

export function MovementsTable({ movements, maxRows }: MovementsTableProps) {
  const displayMovements = maxRows ? movements.slice(0, maxRows) : movements;

  const getMovementIcon = (type: MovementType) => {
    switch (type) {
      case 'stock_in':
        return <ArrowUpCircle className="h-4 w-4" />;
      case 'stock_out':
        return <ArrowDownCircle className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold whitespace-nowrap">Date</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Item</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Type</TableHead>
              <TableHead className="font-semibold text-right whitespace-nowrap">Quantity</TableHead>
              <TableHead className="font-semibold text-right whitespace-nowrap">Unit Cost</TableHead>
              <TableHead className="font-semibold whitespace-nowrap">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayMovements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No movements recorded
                </TableCell>
              </TableRow>
            ) : (
              displayMovements.map((movement) => (
                <TableRow key={movement.id} className="data-table-row">
                  <TableCell className="whitespace-nowrap">
                    {movement.movement_date || movement.created_at?.split('T')[0] || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{movement.item?.item_name || '-'}</div>
                    <div className="text-sm text-muted-foreground">
                      {movement.item?.item_code || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 font-medium',
                        movementTypeColors[movement.movement_type]
                      )}
                    >
                      {getMovementIcon(movement.movement_type)}
                      {movementTypeLabels[movement.movement_type]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {movement.movement_type === 'stock_in' ? '+' : '-'}
                    {movement.quantity}
                  </TableCell>
                  <TableCell className="text-right">
                    {movement.unit_cost ? `Rs. ${movement.unit_cost.toLocaleString()}` : '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {movement.notes || '-'}
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
