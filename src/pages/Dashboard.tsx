import { useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import {
  DollarSign,
  Calendar,
  Users,
  AlertTriangle,
  TrendingUp,
  Clock,
  FileText,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboard } from '@/hooks';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<string, string> = {
  scheduled: 'bg-status-scheduled/10 text-status-scheduled border-status-scheduled/20',
  confirmed: 'bg-status-confirmed/10 text-status-confirmed border-status-confirmed/20',
  completed: 'bg-status-completed/10 text-status-completed border-status-completed/20',
  cancelled: 'bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20',
  no_show: 'bg-muted text-muted-foreground border-border',
};

export default function Dashboard() {
  const { stats, todayAppointments, revenueData, isLoading } = useDashboard();

  // Use the trend from state directly so the bar aligns with the real current month index
  const monthlyTrendData = useMemo(
    () => stats.year.monthly_trend || [],
    [stats.year.monthly_trend]
  );

  // Compute a sensible Y-axis max in 100k steps so the bar is not always full height
  const monthlyAxisMax = useMemo(() => {
    if (!monthlyTrendData.length) return 500000; // default 500k when no data yet
    const maxRevenue = Math.max(...monthlyTrendData.map((m) => m.revenue || 0), 0);
    const step = 100000; // 100k steps
    if (maxRevenue === 0) return 500000;
    return Math.max(step * 5, Math.ceil(maxRevenue / step) * step); // at least 500k
  }, [monthlyTrendData]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboard" subtitle="Welcome back! Here's what's happening today." />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Dashboard" subtitle="Welcome back! Here's what's happening today." />
      
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="stat-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="card-stat-label">Today's Revenue</p>
                  <p className="card-stat-value mt-1">
                    Rs. {stats.today.revenue.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>From payments today</span>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="card-stat-label">Today's Appointments</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="card-stat-value">{stats.today.appointments_completed}</p>
                    <span className="text-sm text-muted-foreground">/ {stats.today.appointments_scheduled + stats.today.appointments_completed}</span>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-chart-2" />
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-chart-2 rounded-full transition-all"
                    style={{ width: `${(stats.today.appointments_completed / (stats.today.appointments_scheduled + stats.today.appointments_completed || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="card-stat-label">New Patients</p>
                  <p className="card-stat-value mt-1">{stats.today.new_patients}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-chart-4" />
                </div>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Registered today
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card border-warning/30 bg-warning/5">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="card-stat-label">Alerts</p>
                  <p className="card-stat-value mt-1 text-warning">
                    {stats.alerts.low_stock_count + stats.alerts.overdue_invoices_count}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{stats.alerts.low_stock_count} low stock items</span>
                <span className="text-muted-foreground">{stats.alerts.overdue_invoices_count} overdue invoices</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Month Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-xl font-bold">Rs. {stats.month.revenue.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Payments</p>
                <p className="text-xl font-bold">Rs. {stats.month.outstanding.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Treatments</p>
                <p className="text-xl font-bold">{stats.month.total_treatments}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Appointments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue Trend */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Revenue Trend (12 Months)</CardTitle>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Growth</p>
                <p className={cn(
                  "text-sm font-semibold",
                  stats.year.previous_month > 0 && stats.year.current_month > stats.year.previous_month 
                    ? "text-success" 
                    : stats.year.previous_month > 0 && stats.year.current_month < stats.year.previous_month
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}>
                  {stats.year.previous_month > 0 
                    ? `${((stats.year.current_month - stats.year.previous_month) / stats.year.previous_month * 100).toFixed(1)}%`
                    : "N/A"
                  }
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      domain={[0, monthlyAxisMax]}
                      ticks={Array.from(
                        { length: Math.floor(monthlyAxisMax / 100000) + 1 },
                        (_, i) => i * 100000
                      )}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Bar 
                      dataKey="revenue" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Current Month</p>
                    <p className="text-sm font-semibold">Rs. {stats.year.current_month.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Previous Month</p>
                    <p className="text-sm font-semibold">Rs. {stats.year.previous_month.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">YTD Revenue</p>
                    <p className="text-sm font-semibold">Rs. {stats.year.ytd_revenue.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Today's Appointments */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Today's Appointments</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/appointments">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayAppointments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No appointments scheduled for today</p>
                  </div>
                ) : (
                  todayAppointments.slice(0, 5).map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center h-12 w-14 rounded-lg bg-background border border-border">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                        <span className="text-xs font-medium">{appointment.start_time}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {appointment.patient?.first_name} {appointment.patient?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{appointment.appointment_type}</p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn('capitalize', statusColors[appointment.status])}
                      >
                        {appointment.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Revenue Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Revenue Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
