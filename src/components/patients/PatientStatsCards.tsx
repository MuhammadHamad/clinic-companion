import { Card, CardContent } from '@/components/ui/card';
import { Users, ArchiveRestore, Calendar, DollarSign } from 'lucide-react';

interface PatientStatsCardsProps {
  total: number;
  active: number;
  newThisMonth: number;
  totalOutstanding: number;
}

export function PatientStatsCards({
  total,
  active,
  newThisMonth,
  totalOutstanding,
}: PatientStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card>
        <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Customers</p>
            <p className="text-lg sm:text-xl font-bold">{total}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
            <ArchiveRestore className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Active</p>
            <p className="text-lg sm:text-xl font-bold">{active}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">New This Month</p>
            <p className="text-lg sm:text-xl font-bold">{newThisMonth}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 rounded-lg bg-financial-unpaid/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-financial-unpaid" />
          </div>
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">Outstanding</p>
            <p className="text-lg sm:text-xl font-bold">Rs. {totalOutstanding.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
