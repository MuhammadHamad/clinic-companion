import { useMemo, useState } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

type RevenueRange = 'week' | 'month' | 'year' | 'allTime';

export default function Dashboard() {
  const { stats, todayAppointments, revenueSeries, isLoading, isRefreshing, lastUpdated, refresh } = useDashboard();
  const [revenueRange, setRevenueRange] = useState<RevenueRange>('week');

  const formatTime12h = (time: string) => {
    const s = String(time || '').trim();
    if (!s) return '';
    const [hhStr, mmStr] = s.split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return s;
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const revenueChartData = useMemo(() => {
    const series = revenueSeries?.[revenueRange] || [];
    return series;
  }, [revenueSeries, revenueRange]);

  const revenueAxisMax = useMemo(() => {
    if (!revenueChartData.length) return 500000;
    const maxRevenue = Math.max(...revenueChartData.map((m) => m.revenue || 0), 0);
    const step = 100000;
    if (maxRevenue === 0) return 500000;
    return Math.max(step * 5, Math.ceil(maxRevenue / step) * step);
  }, [revenueChartData]);

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
        <div className="flex items-center justify-end gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary',
            )}
            onClick={refresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="primary-gradient-card group col-span-1 sm:col-span-2 lg:col-span-1">
            <CardContent className="p-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/80 font-medium">Today's Revenue</p>
                  <p className="text-3xl font-bold mt-2 text-white">
                    Rs. {stats.today.revenue.toLocaleString()}
                  </p>
                </div>
                <div className="relative h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1 group-hover:rotate-6 group-hover:bg-white/30 group-hover:shadow-[0_14px_28px_rgba(0,0,0,0.28)]">
                  <span className="absolute inset-0 rounded-xl bg-white/30 blur-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <DollarSign className="relative z-10 h-5 w-5 text-white transition-transform duration-300 group-hover:scale-110" />
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm text-white/70 bg-black/20 p-2 rounded-lg w-fit">
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
                  <p className="card-stat-label">New Customers</p>
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
          <Card className="ventor-card">
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

          <Card className="ventor-card">
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

          <Card className="ventor-card">
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
          {/* Revenue */}
          <Card className="dashboard-panel">
            <CardHeader className="pb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg font-semibold">Revenue</CardTitle>
              <div className="w-full sm:w-auto overflow-x-auto">
                <Tabs value={revenueRange} onValueChange={(v) => setRevenueRange(v as RevenueRange)}>
                  <TabsList className="h-9 w-max min-w-full justify-start">
                    <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
                    <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
                    <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
                    <TabsTrigger value="allTime" className="text-xs">All Time</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      domain={[0, revenueAxisMax]}
                      ticks={Array.from(
                        { length: Math.floor(revenueAxisMax / 100000) + 1 },
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
          <Card className="dashboard-panel h-[420px] flex flex-col">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Today's Appointments</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/appointments">View All</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto pr-1 space-y-3">
                {todayAppointments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No appointments scheduled for today</p>
                  </div>
                ) : (
                  todayAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center h-12 w-14 rounded-lg bg-background border border-border">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                        <span className="text-xs font-medium">{formatTime12h(appointment.start_time)}</span>
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

      </div>
    </div>
  );
}
