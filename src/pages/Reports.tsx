import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DollarSign, 
  Users, 
  FileText,
  Download,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { mockInvoices, mockInventoryItems, mockPayments, mockTreatmentTypes } from '@/data/mockData';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)', 'hsl(340, 75%, 55%)'];

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    end: new Date().toISOString().split('T')[0], // Today
  });

  // Revenue Report Data
  const revenueData = {
    total_revenue: mockInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total_amount, 0),
    total_patients: new Set(mockInvoices.map(i => i.patient_id)).size,
    total_invoices: mockInvoices.length,
    average_transaction: 0,
  };
  revenueData.average_transaction = revenueData.total_invoices > 0 
    ? Math.round(revenueData.total_revenue / revenueData.total_invoices) 
    : 0;

  const paymentBreakdown = [
    { method: 'Cash', amount: 50000, count: 12 },
    { method: 'Card', amount: 75000, count: 8 },
    { method: 'Bank Transfer', amount: 25000, count: 3 },
    { method: 'Cheque', amount: 5000, count: 1 },
  ];

  const treatmentBreakdown = mockTreatmentTypes.map(t => ({
    name: t.name,
    revenue: Math.floor(Math.random() * 50000) + 10000,
    count: Math.floor(Math.random() * 20) + 5,
  })).slice(0, 6);

  // Outstanding Report Data
  const outstandingInvoices = mockInvoices.filter(i => i.status !== 'paid');
  const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + i.balance, 0);

  const agingAnalysis = [
    { range: '0-30 days', amount: 8500, count: 2 },
    { range: '31-60 days', amount: 5000, count: 1 },
    { range: '61-90 days', amount: 0, count: 0 },
    { range: '90+ days', amount: 15000, count: 1 },
  ];

  // Inventory Report Data
  const inventoryStats = {
    total_value: mockInventoryItems.reduce((sum, i) => sum + (i.current_quantity * (i.unit_cost || 0)), 0),
    total_items: mockInventoryItems.length,
    low_stock: mockInventoryItems.filter(i => i.status === 'low_stock').length,
    out_of_stock: mockInventoryItems.filter(i => i.status === 'out_of_stock').length,
  };

  const categoryBreakdown = [
    { name: 'Dental Materials', value: 45000 },
    { name: 'Medicines', value: 12000 },
    { name: 'Consumables', value: 8000 },
    { name: 'Equipment', value: 25000 },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Reports" subtitle="View analytics and generate reports" />
      
      <div className="p-6 animate-fade-in">
        <Tabs defaultValue="revenue" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <TabsList>
              <TabsTrigger value="revenue" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Revenue
              </TabsTrigger>
              <TabsTrigger value="outstanding" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                Outstanding
              </TabsTrigger>
              <TabsTrigger value="inventory" className="gap-2">
                <Package className="h-4 w-4" />
                Inventory
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className="w-36"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className="w-36"
                />
              </div>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Revenue Report */}
          <TabsContent value="revenue" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-xl font-bold">Rs. {revenueData.total_revenue.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Patients</p>
                    <p className="text-xl font-bold">{revenueData.total_patients}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                    <p className="text-xl font-bold">{revenueData.total_invoices}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-chart-4" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Transaction</p>
                    <p className="text-xl font-bold">Rs. {revenueData.average_transaction.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Method Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Payment Method Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {paymentBreakdown.map((item, index) => (
                      <div key={item.method} className="flex items-center gap-4">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">{item.method}</span>
                            <span className="text-sm text-muted-foreground">{item.count} payments</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{ 
                                width: `${(item.amount / 155000) * 100}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                        <span className="font-medium w-24 text-right">Rs. {item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Revenue by Treatment */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Revenue by Treatment Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={treatmentBreakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          type="number" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          width={80}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, 'Revenue']}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Outstanding Report */}
          <TabsContent value="outstanding" className="space-y-6">
            <Card className="bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Total Outstanding</p>
                  <p className="text-3xl font-bold">Rs. {totalOutstanding.toLocaleString()}</p>
                </div>
                <AlertTriangle className="h-12 w-12 opacity-20" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Aging Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Aging Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Age Range</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agingAnalysis.map((item) => (
                        <TableRow key={item.range}>
                          <TableCell className="font-medium">{item.range}</TableCell>
                          <TableCell className={cn(
                            'text-right font-medium',
                            item.range === '90+ days' && item.amount > 0 && 'text-destructive'
                          )}>
                            Rs. {item.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Outstanding Invoices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Outstanding Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstandingInvoices.map((invoice) => {
                        const daysOld = Math.floor((new Date().getTime() - new Date(invoice.invoice_date).getTime()) / (1000 * 60 * 60 * 24));
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell>
                              <div className="font-medium">{invoice.patient?.first_name} {invoice.patient?.last_name}</div>
                              <div className="text-sm text-muted-foreground">{invoice.invoice_number}</div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-destructive">
                              Rs. {invoice.balance.toLocaleString()}
                            </TableCell>
                            <TableCell className={cn(
                              'text-right',
                              daysOld > 30 && 'text-warning',
                              daysOld > 90 && 'text-destructive'
                            )}>
                              {daysOld}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Inventory Report */}
          <TabsContent value="inventory" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-xl font-bold">Rs. {inventoryStats.total_value.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Items</p>
                    <p className="text-xl font-bold">{inventoryStats.total_items}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={inventoryStats.low_stock > 0 ? 'border-warning/50' : ''}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Low Stock</p>
                    <p className="text-xl font-bold text-warning">{inventoryStats.low_stock}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className={inventoryStats.out_of_stock > 0 ? 'border-destructive/50' : ''}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Out of Stock</p>
                    <p className="text-xl font-bold text-destructive">{inventoryStats.out_of_stock}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Value by Category</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {categoryBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, 'Value']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap justify-center gap-4">
                    {categoryBreakdown.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Low/Out of Stock Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Items Needing Attention</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-center">Min</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockInventoryItems
                        .filter(i => i.status !== 'in_stock')
                        .map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.item_name}</div>
                              <div className="text-sm text-muted-foreground">{item.item_code}</div>
                            </TableCell>
                            <TableCell className={cn(
                              'text-center font-medium',
                              item.status === 'out_of_stock' && 'text-destructive',
                              item.status === 'low_stock' && 'text-warning'
                            )}>
                              {item.current_quantity}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {item.minimum_threshold}
                            </TableCell>
                            <TableCell>
                              <span className={cn(
                                'status-badge',
                                item.status === 'low_stock' && 'bg-warning/10 text-warning',
                                item.status === 'out_of_stock' && 'bg-destructive/10 text-destructive'
                              )}>
                                {item.status === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
