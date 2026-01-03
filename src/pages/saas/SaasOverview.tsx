import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

type Kpi = {
  totalClinics: number | null;
  totalUsers: number | null;
  monthRevenue: number | null;
};

export default function SaasOverview() {
  const [kpi, setKpi] = useState<Kpi>({
    totalClinics: null,
    totalUsers: null,
    monthRevenue: null,
  });
  const [warnings, setWarnings] = useState<string[]>([]);

  const monthStart = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    return start.toISOString().split('T')[0];
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const nextWarnings: string[] = [];

      const [clinicsRes, usersRes, revenueRes] = await Promise.all([
        supabase.from('clinics').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('amount').gte('payment_date', monthStart),
      ]);

      let totalClinics: number | null = null;
      if (clinicsRes.error) {
        nextWarnings.push('Clinics data unavailable (missing table or permission).');
      } else {
        totalClinics = clinicsRes.count ?? 0;
      }

      let totalUsers: number | null = null;
      if (usersRes.error) {
        nextWarnings.push('Users data unavailable (permission restricted by RLS).');
      } else {
        totalUsers = usersRes.count ?? 0;
      }

      let monthRevenue: number | null = null;
      if (revenueRes.error) {
        nextWarnings.push('Revenue data unavailable (permission restricted by RLS).');
      } else {
        monthRevenue = (revenueRes.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      }

      if (cancelled) return;
      setWarnings(nextWarnings);
      setKpi({ totalClinics, totalUsers, monthRevenue });
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [monthStart]);

  return (
    <div className="min-h-screen">
      <Header title="SaaS Overview" subtitle="Platform summary across all clinics" />

      <div className="p-6 space-y-6 animate-fade-in">
        {warnings.length > 0 && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Setup Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {warnings.map((w) => (
                <div key={w} className="text-sm text-muted-foreground">
                  {w}
                </div>
              ))}
              <div className="text-sm text-muted-foreground">
                This is expected until the multi-clinic tables and RLS policies are configured.
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clinics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {kpi.totalClinics ?? '—'}
              </div>
              <div className="mt-2">
                <Badge variant="secondary">MVP</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {kpi.totalUsers ?? '—'}
              </div>
              <div className="mt-2">
                <Badge variant="secondary">MVP</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (This Month)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {kpi.monthRevenue === null ? '—' : `Rs. ${kpi.monthRevenue.toLocaleString()}`}
              </div>
              <div className="mt-2">
                <Badge variant="secondary">MVP</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next MVP actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>- Add a clinics table + clinic_id scoping for data (multi-tenant).</div>
            <div>- Add invitations so clinics can onboard staff safely.</div>
            <div>- Add a global user directory (profiles) to show email/name.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
