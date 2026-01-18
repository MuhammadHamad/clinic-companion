import { Card, CardContent } from '@/components/ui/card';
import { Package, AlertTriangle } from 'lucide-react';

interface InventoryStatsCardsProps {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  onTotalClick?: () => void;
  onLowStockClick?: () => void;
  onOutOfStockClick?: () => void;
  onValueClick?: () => void;
}

export function InventoryStatsCards({
  totalItems,
  lowStockCount,
  outOfStockCount,
  totalValue,
  onTotalClick,
  onLowStockClick,
  onOutOfStockClick,
  onValueClick,
}: InventoryStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent
          className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onTotalClick}
        >
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Items</p>
            <p className="text-lg sm:text-xl font-bold">{totalItems}</p>
          </div>
        </CardContent>
      </Card>
      <Card className={lowStockCount > 0 ? 'border-warning/50' : ''}>
        <CardContent
          className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onLowStockClick}
        >
          <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Low Stock</p>
            <p className="text-lg sm:text-xl font-bold text-warning">{lowStockCount}</p>
          </div>
        </CardContent>
      </Card>
      <Card className={outOfStockCount > 0 ? 'border-destructive/50' : ''}>
        <CardContent
          className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onOutOfStockClick}
        >
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Out of Stock</p>
            <p className="text-lg sm:text-xl font-bold text-destructive">{outOfStockCount}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent
          className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onValueClick}
        >
          <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Value</p>
            <p className="text-lg sm:text-xl font-bold">Rs. {totalValue.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
