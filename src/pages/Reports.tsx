import { useState, useEffect, useMemo } from 'react';
import { logger } from '@/lib/logger';
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
  RefreshCw,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useInvoices, useInventory, usePatients } from '@/hooks';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';

const COLORS = ['hsl(217, 91%, 60%)', 'hsl(160, 84%, 39%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)', 'hsl(340, 75%, 55%)'];

export default function Reports() {
  const { invoices, fetchInvoices, lastUpdated: invoicesLastUpdated } = useInvoices();
  const { items, fetchItems, fetchCategories, fetchMovements, lastUpdated: inventoryLastUpdated } = useInventory();
  const { patients, fetchPatients, lastUpdated: patientsLastUpdated } = usePatients();
  const { activeClinic } = useTenant();
  const [activeTab, setActiveTab] = useState<'revenue' | 'outstanding' | 'inventory'>('revenue');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    // Initialize with the most recent timestamp from hooks
    const timestamps = [invoicesLastUpdated, inventoryLastUpdated, patientsLastUpdated].filter(Boolean);
    return timestamps.length > 0 ? new Date(Math.max(...timestamps.map(d => d!.getTime()))) : null;
  });
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    end: new Date().toISOString().split('T')[0], // Today
  });

  // Filter out void invoices for accurate reporting
  const activeInvoices = useMemo(() => invoices.filter((i) => !i.is_void), [invoices]);

  const [paymentBreakdown, setPaymentBreakdown] = useState<{
    method: string;
    amount: number;
    count: number;
  }[]>([]);

  const [paymentsInRange, setPaymentsInRange] = useState<{
    invoice_id: string;
    amount: number;
    payment_method: string;
    payment_date: string;
  }[]>([]);

  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  const paymentsStats = useMemo(() => {
    const totalRevenue = paymentsInRange.reduce((sum, p) => sum + p.amount, 0);
    const invoiceIds = new Set<string>();
    paymentsInRange.forEach((p) => {
      if (p.invoice_id) invoiceIds.add(p.invoice_id);
    });

    return {
      totalRevenue,
      invoiceCount: invoiceIds.size,
    };
  }, [paymentsInRange]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        fetchInvoices(),
        fetchPatients(),
        fetchItems(),
        fetchCategories(),
        fetchMovements(),
      ]);
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  // Update lastUpdated when any of the hooks' data is refreshed
  useEffect(() => {
    const timestamps = [invoicesLastUpdated, inventoryLastUpdated, patientsLastUpdated].filter(Boolean);
    if (timestamps.length > 0) {
      const latest = new Date(Math.max(...timestamps.map(d => d!.getTime())));
      setLastUpdated(latest);
    }
  }, [invoicesLastUpdated, inventoryLastUpdated, patientsLastUpdated]);

  // Invoices filtered by selected invoice_date range (excluding void)
  const invoicesInRange = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return activeInvoices;

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    return activeInvoices.filter((inv) => {
      if (!inv.invoice_date) return false;
      const invDate = new Date(inv.invoice_date);
      return invDate >= startDate && invDate <= endDate;
    });
  }, [activeInvoices, dateRange.start, dateRange.end]);

  // Revenue Report Data - using invoices in date range only
  const revenueData = {
    total_revenue:
      paymentsStats.totalRevenue > 0
        ? paymentsStats.totalRevenue
        : invoicesInRange.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total_amount, 0),
    total_patients: patients.length,
    total_invoices: paymentsStats.invoiceCount > 0 ? paymentsStats.invoiceCount : invoicesInRange.length,
    average_transaction: 0,
  };
  revenueData.average_transaction = revenueData.total_invoices > 0 
    ? Math.round(revenueData.total_revenue / revenueData.total_invoices) 
    : 0;

  // Revenue by Treatment Type - using same data source as total revenue for consistency
  const treatmentBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();

    const paidByInvoiceId = new Map<string, number>();
    paymentsInRange.forEach((p) => {
      if (!p.invoice_id) return;
      paidByInvoiceId.set(p.invoice_id, (paidByInvoiceId.get(p.invoice_id) || 0) + (Number(p.amount) || 0));
    });

    const shouldUsePayments = paymentsStats.totalRevenue > 0;

    invoicesInRange
      .filter((inv) => (shouldUsePayments ? (inv.status === 'paid' || inv.status === 'partial') : inv.status === 'paid'))
      .forEach((inv) => {
        const targetRevenue = shouldUsePayments ? (paidByInvoiceId.get(inv.id) || 0) : Number(inv.total_amount || 0);
        if (targetRevenue <= 0) return;

        const items = inv.items || [];
        const itemsSum = items.reduce((sum, it) => sum + (Number(it.total) || 0), 0);

        if (!items.length || itemsSum <= 0) {
          const key = 'Other';
          const existing = map.get(key) || { name: key, revenue: 0, count: 0 };
          existing.revenue += targetRevenue;
          existing.count += 1;
          map.set(key, existing);
          return;
        }

        items.forEach((item) => {
          const name = item.description || 'Other';
          const existing = map.get(name) || { name, revenue: 0, count: 0 };
          const share = (Number(item.total) || 0) / itemsSum;
          existing.revenue += targetRevenue * share;
          existing.count += 1;
          map.set(name, existing);
        });
      });

    const sorted = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const maxBars = 6;
    if (sorted.length <= maxBars) return sorted;

    const top = sorted.slice(0, maxBars - 1);
    const otherTotal = sorted.slice(maxBars - 1).reduce((sum, row) => sum + row.revenue, 0);
    const otherCount = sorted.slice(maxBars - 1).reduce((sum, row) => sum + row.count, 0);

    return [...top, { name: 'Other', revenue: otherTotal, count: otherCount }];
  }, [invoicesInRange, paymentsInRange, paymentsStats.totalRevenue]);

  // Payment Method Breakdown - aligned with invoice date ranges for consistency
  useEffect(() => {
    const fetchPaymentBreakdown = async () => {
      try {
        setIsLoadingPayments(true);
        
        // Get invoice IDs in the selected date range first
        const invoiceIdsInRange = invoicesInRange.map(inv => inv.id);
        
        if (invoiceIdsInRange.length === 0) {
          setPaymentsInRange([]);
          setPaymentBreakdown([]);
          return;
        }

        // Fetch payments for these invoices only
        const { data, error } = await supabase
          .from('payments')
          .select('invoice_id, payment_method, amount, payment_date')
          .in('invoice_id', invoiceIdsInRange);

        if (error) throw error;

        const payments = (data || []).map((p: any) => ({
          invoice_id: p.invoice_id as string,
          payment_method: p.payment_method as string,
          amount: Number(p.amount) || 0,
          payment_date: p.payment_date as string,
        }));

        setPaymentsInRange(payments);

        const map = new Map<string, { method: string; amount: number; count: number }>();

        payments.forEach((p) => {
          const existing = map.get(p.payment_method) || { method: p.payment_method, amount: 0, count: 0 };
          existing.amount += p.amount;
          existing.count += 1;
          map.set(p.payment_method, existing);
        });

        const breakdown = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
        setPaymentBreakdown(breakdown);
      } catch (error) {
        logger.error('Error fetching payment breakdown:', error);
      } finally {
        setIsLoadingPayments(false);
      }
    };

    fetchPaymentBreakdown();
  }, [invoicesInRange]);

  // Outstanding Report Data - excluding void invoices
  const outstandingInvoices = activeInvoices.filter(i => i.status !== 'paid');
  const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + i.balance, 0);

  // Real Aging Analysis based on actual invoice dates
  const agingAnalysis = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const aging = [
      { range: '0-30 days', amount: 0, count: 0 },
      { range: '31-60 days', amount: 0, count: 0 },
      { range: '61-90 days', amount: 0, count: 0 },
      { range: '90+ days', amount: 0, count: 0 },
    ];

    outstandingInvoices.forEach(invoice => {
      if (!invoice.invoice_date) return;
      
      const invoiceDate = new Date(invoice.invoice_date);
      const daysOverdue = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let categoryIndex;
      if (daysOverdue <= 30) categoryIndex = 0;
      else if (daysOverdue <= 60) categoryIndex = 1;
      else if (daysOverdue <= 90) categoryIndex = 2;
      else categoryIndex = 3;
      
      aging[categoryIndex].amount += invoice.balance || 0;
      aging[categoryIndex].count += 1;
    });

    return aging;
  }, [outstandingInvoices]);

  // Inventory Report Data
  const inventoryStats = {
    total_value: items.reduce((sum, i) => sum + (i.current_quantity * (i.unit_cost || 0)), 0),
    total_items: items.length,
    low_stock: items.filter(i => i.status === 'low_stock').length,
    out_of_stock: items.filter(i => i.status === 'out_of_stock').length,
  };

  const categoryBreakdown = [
    { name: 'Clinic Supplies', value: 45000 },
    { name: 'Medicines', value: 12000 },
    { name: 'Consumables', value: 8000 },
    { name: 'Equipment', value: 25000 },
  ];

  const patientsRegisteredInRange = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return 0;
    const startDate = new Date(`${dateRange.start}T00:00:00`);
    const endDate = new Date(`${dateRange.end}T23:59:59`);

    return patients.filter((p) => {
      const created = p.created_at ? new Date(p.created_at) : null;
      const fallback = p.registration_date ? new Date(`${p.registration_date}T00:00:00`) : null;
      const d = created || fallback;
      if (!d || Number.isNaN(d.getTime())) return false;
      return d >= startDate && d <= endDate;
    }).length;
  }, [patients, dateRange.start, dateRange.end]);

  const escapeHtml = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatCurrency = (amount: unknown) => {
    const n = Number(amount) || 0;
    return `Rs. ${n.toLocaleString()}`;
  };

  const handleExport = () => {
    const safeStart = dateRange.start || 'start';
    const safeEnd = dateRange.end || 'end';

    const clinicDisplayName = (activeClinic?.name || '').trim() || 'Clinic';

    const titleByTab: Record<string, string> = {
      revenue: 'Revenue Report',
      outstanding: 'Outstanding Report',
      inventory: 'Inventory Report',
    };

    const now = new Date();
    const generatedAt = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)}`;

    const section = (heading: string, body: string) => `
      <div class="section">
        <div class="section-title">${escapeHtml(heading)}</div>
        ${body}
      </div>
    `;

    const table = (headers: string[], rows: (string | number)[][]) => {
      const thead = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
      const tbody = rows
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('');
      return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    };

    let bodyHtml = '';

    if (activeTab === 'revenue') {
      bodyHtml += section(
        'Summary',
        table(
          ['Metric', 'Value'],
          [
            ['Total Revenue', formatCurrency(revenueData.total_revenue)],
            ['Total Patients (All Time)', String(revenueData.total_patients)],
            ['New Patients (In Range)', String(patientsRegisteredInRange)],
            ['Total Invoices', String(revenueData.total_invoices)],
            ['Avg Transaction', formatCurrency(revenueData.average_transaction)],
          ],
        ),
      );

      bodyHtml += section(
        'Payment Method Breakdown',
        table(
          ['Method', 'Payments', 'Amount'],
          paymentBreakdown.map((p) => [
            String(p.method),
            String(p.count),
            formatCurrency(p.amount),
          ]),
        ),
      );

      bodyHtml += section(
        'Revenue by Treatment Type',
        table(
          ['Treatment', 'Count', 'Revenue'],
          treatmentBreakdown.map((t) => [
            String(t.name),
            String(t.count),
            formatCurrency(Math.round(t.revenue)),
          ]),
        ),
      );
    }

    if (activeTab === 'outstanding') {
      bodyHtml += section(
        'Summary',
        table(
          ['Metric', 'Value'],
          [
            ['Total Outstanding', formatCurrency(totalOutstanding)],
            ['Outstanding Invoices', String(outstandingInvoices.length)],
          ],
        ),
      );

      bodyHtml += section(
        'Aging Analysis',
        table(
          ['Range', 'Count', 'Amount'],
          agingAnalysis.map((a) => [String(a.range), String(a.count), formatCurrency(a.amount)]),
        ),
      );

      bodyHtml += section(
        'Outstanding Invoices',
        table(
          ['Invoice #', 'Invoice Date', 'Patient', 'Status', 'Total', 'Paid', 'Balance'],
          outstandingInvoices.map((inv) => [
            String(inv.invoice_number || ''),
            String(inv.invoice_date || ''),
            String(inv.patient_id || ''),
            String(inv.status || ''),
            formatCurrency(inv.total_amount),
            formatCurrency(inv.amount_paid),
            formatCurrency(inv.balance),
          ]),
        ),
      );
    }

    if (activeTab === 'inventory') {
      bodyHtml += section(
        'Summary',
        table(
          ['Metric', 'Value'],
          [
            ['Total Items', String(inventoryStats.total_items)],
            ['Total Value', formatCurrency(Math.round(inventoryStats.total_value))],
            ['Low Stock', String(inventoryStats.low_stock)],
            ['Out of Stock', String(inventoryStats.out_of_stock)],
          ],
        ),
      );

      bodyHtml += section(
        'Items',
        table(
          ['Name', 'Category', 'Status', 'Quantity', 'Unit Cost', 'Total Value'],
          items.map((it: any) => {
            const qty = Number(it.current_quantity) || 0;
            const cost = Number(it.unit_cost) || 0;
            return [
              String(it.name || ''),
              String(it.category || ''),
              String(it.status || ''),
              String(qty),
              formatCurrency(cost),
              formatCurrency(Math.round(qty * cost)),
            ];
          }),
        ),
      );

      bodyHtml += section(
        'Category Breakdown',
        table(
          ['Category', 'Value'],
          categoryBreakdown.map((c) => [String(c.name), formatCurrency(c.value)]),
        ),
      );
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(titleByTab[activeTab] || 'Report')}</title>
          <style>
            :root {
              color-scheme: light;
              --text: #0b1220;
              --muted: #475569;
              --border: #dbe3f0;
              --soft: #fbfdff;
              --header: #f4f7fb;
              --accent: #2563eb; /* professional blue */
              --accent-soft: rgba(37, 99, 235, 0.08);
            }
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: var(--text); margin: 0; background: #ffffff; }
            .page { padding: 30px; }
            .header { position: relative; display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; border-bottom: 2px solid var(--border); padding-bottom: 16px; margin-bottom: 20px; }
            .header::before { content: ""; position: absolute; left: 0; top: -10px; width: 72px; height: 4px; border-radius: 999px; background: var(--accent); }
            .brand { font-weight: 900; font-size: 22px; letter-spacing: 0.2px; }
            .title { font-weight: 700; font-size: 16px; margin-top: 8px; color: #1e293b; }
            .meta { font-size: 13px; color: var(--muted); line-height: 1.6; text-align: right; }
            .meta strong { color: #1e293b; font-weight: 700; }
            .section { margin: 18px 0 22px; }
            .section-title {
              font-weight: 900;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #1e40af;
              margin-bottom: 10px;
              padding-left: 10px;
              border-left: 3px solid var(--accent);
            }
            table { width: 100%; border-collapse: collapse; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
            th, td { border-bottom: 1px solid var(--border); padding: 10px 12px; font-size: 13px; vertical-align: top; }
            th { background: var(--header); text-align: left; font-weight: 900; color: #0f172a; }
            tbody tr:nth-child(even) td { background: var(--soft); }
            tr:last-child td { border-bottom: none; }
            .footer { margin-top: 18px; padding-top: 12px; border-top: 1px dashed var(--border); font-size: 12px; color: var(--muted); }
            @media print {
              .page { padding: 14mm; }
              a { color: inherit; text-decoration: none; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div>
                <div class="brand">${escapeHtml(clinicDisplayName)}</div>
                <div class="title">${escapeHtml(titleByTab[activeTab] || 'Report')}</div>
              </div>
              <div class="meta">
                <div><strong>Date Range:</strong> ${escapeHtml(safeStart)} to ${escapeHtml(safeEnd)}</div>
                <div><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
              </div>
            </div>

            ${bodyHtml}

            <div class="footer">Powered by Endicode Clinic.</div>
          </div>

          <script>
            window.addEventListener('load', () => {
              // Give layout/fonts a moment to settle before printing.
              setTimeout(() => {
                try {
                  window.focus();
                  window.print();
                } catch (e) {
                  // ignore
                }
              }, 350);
            });
          </script>
        </body>
      </html>
    `;

    // More reliable than document.write(): open a Blob URL.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');

    // If popups are blocked, fall back to same-tab navigation.
    if (!w) {
      window.location.assign(url);
    }

    // Revoke after a short delay (after the new tab has loaded).
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <div className="min-h-screen">
      <Header title="Reports" subtitle="View analytics and generate reports" />
      
      <div className="p-4 sm:p-6 animate-fade-in overflow-x-hidden">
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
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <Tabs defaultValue="revenue" className="space-y-6" onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <TabsList className="w-max min-w-full justify-start">
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
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Date</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="w-full sm:w-36"
                  />
                  <span className="hidden sm:inline text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="w-full sm:w-36"
                  />
                </div>
              </div>
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Revenue Report */}
          <TabsContent value="revenue" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  {isLoadingPayments ? (
                    <p className="text-sm text-muted-foreground">Loading payment data...</p>
                  ) : paymentBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments in the selected period.</p>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const totalAmount = paymentBreakdown.reduce((sum, p) => sum + p.amount, 0) || 1;
                        return paymentBreakdown.map((item, index) => (
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
                                    width: `${(item.amount / totalAmount) * 100}%`,
                                    backgroundColor: COLORS[index % COLORS.length]
                                  }}
                                />
                              </div>
                            </div>
                            <span className="font-medium w-24 text-right">Rs. {item.amount.toLocaleString()}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
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
                          width={90}
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
                  <p className="text-sm text-foreground opacity-80">Total Outstanding</p>
                  <p className="text-3xl font-bold text-foreground">Rs. {totalOutstanding.toLocaleString()}</p>
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Age Range</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Amount</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Invoices</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agingAnalysis.map((item) => (
                          <TableRow key={item.range}>
                            <TableCell className="font-medium whitespace-nowrap">{item.range}</TableCell>
                            <TableCell
                              className={cn(
                                'text-right font-medium whitespace-nowrap',
                                item.range === '90+ days' && item.amount > 0 && 'text-destructive'
                              )}
                            >
                              Rs. {item.amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">{item.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Outstanding Invoices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Outstanding Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Patient</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Balance</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outstandingInvoices.map((invoice) => {
                          const daysOld = Math.floor(
                            (new Date().getTime() - new Date(invoice.invoice_date).getTime()) / (1000 * 60 * 60 * 24)
                          );
                          return (
                            <TableRow key={invoice.id}>
                              <TableCell className="min-w-[220px]">
                                <div className="font-medium">{invoice.patient?.first_name} {invoice.patient?.last_name}</div>
                                <div className="text-sm text-muted-foreground whitespace-nowrap">{invoice.invoice_number}</div>
                              </TableCell>
                              <TableCell className="text-right font-medium text-destructive whitespace-nowrap">
                                Rs. {invoice.balance.toLocaleString()}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right whitespace-nowrap',
                                  daysOld > 30 && 'text-warning',
                                  daysOld > 90 && 'text-destructive'
                                )}
                              >
                                {daysOld}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Inventory Report */}
          <TabsContent value="inventory" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Item</TableHead>
                          <TableHead className="text-center whitespace-nowrap">Qty</TableHead>
                          <TableHead className="text-center whitespace-nowrap">Min</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items
                          .filter(i => i.status !== 'in_stock')
                          .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="min-w-[220px]">
                                <div className="font-medium">{item.item_name}</div>
                                <div className="text-sm text-muted-foreground whitespace-nowrap">{item.item_code}</div>
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-center font-medium whitespace-nowrap',
                                  item.status === 'out_of_stock' && 'text-destructive',
                                  item.status === 'low_stock' && 'text-warning'
                                )}
                              >
                                {item.current_quantity}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground whitespace-nowrap">
                                {item.minimum_threshold}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <span
                                  className={cn(
                                    'status-badge',
                                    item.status === 'low_stock' && 'bg-warning/10 text-warning',
                                    item.status === 'out_of_stock' && 'bg-destructive/10 text-destructive'
                                  )}
                                >
                                  {item.status === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
