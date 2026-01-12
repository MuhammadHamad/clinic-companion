import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';


type Kpi = {
  customers: number | null;
  invoices: number | null;
  users: number | null;
  outstanding: number | null;
  monthRevenue: number | null;
};

type ClinicRow = {
  id: string;
  name: string;
  slug?: string | null;
};

type RecentInvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string | null;
  total_amount: number;
  balance: number;
  status: string;
  patient?: {
    first_name?: string | null;
    last_name?: string | null;
    patient_number?: string | null;
  } | null;
};

type TopCustomerRow = {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  balance: number;
};

type UserRoleRow = {
  user_id: string;
  role: string;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

function SaasClinicInsights() {
  const navigate = useNavigate();
  const { clinicId } = useParams();
  const { setActiveClinicId } = useTenant();

  const [clinic, setClinic] = useState<ClinicRow | null>(null);
  const [kpi, setKpi] = useState<Kpi>({
    customers: null,
    invoices: null,
    users: null,
    outstanding: null,
    monthRevenue: null,
  });

  const [recentInvoices, setRecentInvoices] = useState<RecentInvoiceRow[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomerRow[]>([]);
  const [staff, setStaff] = useState<Array<UserRoleRow & { profile: ProfileRow | null }>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const monthStart = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    return start.toISOString().split('T')[0];
  }, []);

  useEffect(() => {
    if (!clinicId) return;
    setActiveClinicId(clinicId);
  }, [clinicId, setActiveClinicId]);

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const nextWarnings: string[] = [];

      const [clinicRes, customersRes, invoicesRes, usersRes, revenueRes, outstandingRes, recentInvoicesRes, topCustomersRes] =
        await Promise.all([
          supabase.from('clinics').select('id, name, slug').eq('id', clinicId).single(),
          supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
          supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('clinic_id', clinicId),
          supabase.from('payments').select('amount').eq('clinic_id', clinicId).gte('payment_date', monthStart),
          supabase.from('patients').select('balance').eq('clinic_id', clinicId).neq('status', 'archived'),
          supabase
            .from('invoices')
            .select('id, invoice_number, invoice_date, total_amount, balance, status, patient:patients(first_name,last_name,patient_number)')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('patients')
            .select('id, patient_number, first_name, last_name, balance')
            .eq('clinic_id', clinicId)
            .gt('balance', 0)
            .order('balance', { ascending: false })
            .limit(5),
        ]);

      if (clinicRes.error) {
        nextWarnings.push('Clinic info unavailable (missing table or permission).');
      }

      if (customersRes.error) nextWarnings.push('Customers count unavailable (permission restricted by RLS).');
      if (invoicesRes.error) nextWarnings.push('Invoices count unavailable (permission restricted by RLS).');
      if (usersRes.error) nextWarnings.push('Staff count unavailable (permission restricted by RLS).');
      if (revenueRes.error) nextWarnings.push('Revenue unavailable (permission restricted by RLS).');
      if (outstandingRes.error) nextWarnings.push('Outstanding unavailable (permission restricted by RLS).');

      const customers = customersRes.error ? null : customersRes.count ?? 0;
      const invoices = invoicesRes.error ? null : invoicesRes.count ?? 0;
      const users = usersRes.error ? null : usersRes.count ?? 0;
      const monthRevenue = revenueRes.error
        ? null
        : (revenueRes.data || []).reduce((sum, p: any) => sum + Number(p.amount || 0), 0);
      const outstanding = outstandingRes.error
        ? null
        : (outstandingRes.data || []).reduce((sum, p: any) => sum + Number(p.balance || 0), 0);

      let nextRecentInvoices: RecentInvoiceRow[] = [];
      if (!recentInvoicesRes.error) {
        nextRecentInvoices = (recentInvoicesRes.data || []) as any;
      } else {
        nextWarnings.push('Recent invoices unavailable (permission restricted by RLS).');
      }

      let nextTopCustomers: TopCustomerRow[] = [];
      if (!topCustomersRes.error) {
        nextTopCustomers = (topCustomersRes.data || []) as any;
      } else {
        nextWarnings.push('Top outstanding customers unavailable (permission restricted by RLS).');
      }

      const rolesRes = await supabase
        .from('user_roles')
        .select('user_id, role, created_at')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      let nextStaff: Array<UserRoleRow & { profile: ProfileRow | null }> = [];
      if (!rolesRes.error) {
        const roleRows = (rolesRes.data || []) as UserRoleRow[];
        const userIds = Array.from(new Set(roleRows.map((r) => r.user_id).filter(Boolean)));

        const profilesRes = userIds.length
          ? await supabase.from('profiles').select('id, email, first_name, last_name').in('id', userIds)
          : { data: [], error: null };

        if (profilesRes.error) {
          nextWarnings.push('Staff profiles unavailable (permission restricted by RLS).');
        }

        const profilesById = new Map(((profilesRes.data || []) as ProfileRow[]).map((p) => [p.id, p] as const));
        nextStaff = roleRows.map((r) => ({ ...r, profile: profilesById.get(r.user_id) || null }));
      } else {
        nextWarnings.push('Staff list unavailable (permission restricted by RLS).');
      }

      if (cancelled) return;

      setClinic(clinicRes.error ? null : ((clinicRes.data as any) || null));
      setKpi({ customers, invoices, users, outstanding, monthRevenue });
      setRecentInvoices(nextRecentInvoices);
      setTopCustomers(nextTopCustomers);
      setStaff(nextStaff);
      setWarnings(nextWarnings);
      setIsLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [clinicId, monthStart]);

  const title = clinic?.name ? `Clinic Insights • ${clinic.name}` : 'Clinic Insights';

  return (
    <div className="min-h-screen">
      <Header title={title} subtitle={clinic?.slug ? `Slug: ${clinic.slug}` : 'Key metrics and recent activity'} />

      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/saas/clinics')}>Back to Clinics</Button>
          <div className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : clinic ? `Clinic ID: ${clinic.id}` : '—'}
          </div>
        </div>

        {warnings.length > 0 && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {warnings.map((w) => (
                <div key={w} className="text-sm text-muted-foreground">
                  {w}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.customers ?? '—'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.invoices ?? '—'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Staff Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.users ?? '—'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.outstanding === null ? '—' : `Rs. ${kpi.outstanding.toLocaleString()}`}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (This Month)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.monthRevenue === null ? '—' : `Rs. ${kpi.monthRevenue.toLocaleString()}`}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Outstanding Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                        No outstanding balances
                      </TableCell>
                    </TableRow>
                  ) : (
                    topCustomers.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.first_name} {p.last_name}</div>
                          <div className="text-xs text-muted-foreground">{p.patient_number}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">Rs. {Number(p.balance || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No invoices found
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="font-medium">{inv.invoice_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {(inv.patient?.first_name || '')} {(inv.patient?.last_name || '')}
                            {inv.patient?.patient_number ? ` • ${inv.patient.patient_number}` : ''}
                            {inv.invoice_date ? ` • ${inv.invoice_date}` : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'paid' ? 'secondary' : inv.status === 'unpaid' ? 'destructive' : 'outline'}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">Rs. {Number(inv.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">Rs. {Number(inv.balance || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No staff found
                    </TableCell>
                  </TableRow>
                ) : (
                  staff.map((u) => (
                    <TableRow key={`${u.user_id}-${u.role}`}
                      >
                      <TableCell>
                        <div className="font-medium">
                          {(u.profile?.first_name || '')} {(u.profile?.last_name || '')}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.profile?.email || u.user_id}</div>
                      </TableCell>
                      <TableCell className="capitalize">{u.role.replace('_', ' ')}</TableCell>
                      <TableCell className="text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SaasClinicInsights;
