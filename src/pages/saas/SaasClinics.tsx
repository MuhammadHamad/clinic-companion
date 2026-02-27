import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, FileText, DollarSign, ArrowRight, PauseCircle, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

type ClinicRow = {
  id: string;
  name: string;
  slug?: string | null;
  created_at?: string | null;
  is_paused?: boolean | null;
  paused_at?: string | null;
  pause_reason?: string | null;
  admin_email?: string | null;
};

type ClinicStats = {
  customers: number;
  invoices: number;
  staff: number;
  outstanding: number;
};

export default function SaasClinics() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeClinicId, setActiveClinicId } = useTenant();
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [clinicStats, setClinicStats] = useState<Record<string, ClinicStats>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [setupWarning, setSetupWarning] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clinicToDelete, setClinicToDelete] = useState<ClinicRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [clinicToPause, setClinicToPause] = useState<ClinicRow | null>(null);
  const [pauseReason, setPauseReason] = useState('');
  const [isPausing, setIsPausing] = useState(false);

  const statsCacheRef = useRef<{ key: string; fetchedAt: number }>({ key: '', fetchedAt: 0 });
  const statsTtlMs = 60_000;

  const fetchClinics = async () => {
    setIsLoading(true);
    setSetupWarning(null);

    const withPauseFields = await supabase
      .from('clinics')
      .select(`
        id, name, slug, created_at, is_paused, paused_at, pause_reason,
        clinic_admin_emails!inner(admin_email)
      `)
      .order('created_at', { ascending: false });

    let data: any[] | null = withPauseFields.data as any[] | null;
    let error = withPauseFields.error as any;

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      const withEmailTable = await supabase
        .from('clinics')
        .select(`
          id, name, slug, created_at,
          clinic_admin_emails!inner(admin_email)
        `)
        .order('created_at', { ascending: false });

      if (!withEmailTable.error) {
        data = withEmailTable.data as any[] | null;
        error = withEmailTable.error as any;
      } else {
        const legacy = await supabase
          .from('clinics')
          .select('id, name, slug, created_at')
          .order('created_at', { ascending: false });

        data = legacy.data as any[] | null;
        error = legacy.error as any;
      }
    }

    if (error) {
      setClinics([]);
      setSetupWarning('Clinics table is not accessible yet (missing table or RLS policy).');
    } else {
      const clinicRows = ((data || []) as ClinicRow[]).map((c) => ({
        ...c,
        is_paused: c.is_paused ?? false,
        paused_at: c.paused_at ?? null,
        pause_reason: c.pause_reason ?? null,
        admin_email: (c as any).clinic_admin_emails?.[0]?.admin_email ?? null,
      }));
      setClinics(clinicRows);
      if (clinicRows.length > 0) {
        fetchClinicStats(clinicRows.map((c) => c.id));
      } else {
        setClinicStats({});
      }
    }

    setIsLoading(false);
  };

  const fetchClinicStats = async (clinicIds: string[]) => {
    const nextKey = clinicIds.slice().sort().join(',');
    const now = Date.now();
    if (statsCacheRef.current.key === nextKey && now - statsCacheRef.current.fetchedAt < statsTtlMs) {
      return;
    }

    setIsLoadingStats(true);

    const { data, error } = await supabase.rpc('get_clinic_stats', {
      clinic_ids: clinicIds,
    });

    if (error) {
      if (error.message.includes('Could not find the function')) {
        console.warn('RPC get_clinic_stats not found - please apply database-migrations/clinic_stats_rpc.sql');
        setClinicStats({});
      } else {
        toast({
          title: 'Failed to load clinic stats',
          description: error.message,
          variant: 'destructive',
        });
      }
      setIsLoadingStats(false);
      return;
    }

    const statsMap: Record<string, ClinicStats> = {};
    (data || []).forEach((row: any) => {
      const clinicId = String(row.clinic_id);
      statsMap[clinicId] = {
        customers: Number(row.customers || 0),
        invoices: Number(row.invoices || 0),
        staff: Number(row.staff || 0),
        outstanding: Number(row.outstanding || 0),
      };
    });

    statsCacheRef.current = { key: nextKey, fetchedAt: now };
    setClinicStats(statsMap);
    setIsLoadingStats(false);
  };

  useEffect(() => {
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter((c) => {
      const hay = `${c.name || ''} ${c.slug || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [clinics, search]);

  const openClinic = (clinic: ClinicRow) => {
    setActiveClinicId(clinic.id);
    navigate(`/saas/clinics/${clinic.id}`);
  };

  const createClinic = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast({
        title: 'Validation error',
        description: 'Clinic name and slug are required',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('clinics').insert({
      name: form.name.trim(),
      slug: form.slug.trim(),
    });

    if (error) {
      toast({
        title: 'Failed to create clinic',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Clinic created',
      description: 'Clinic has been added successfully',
    });

    setIsDialogOpen(false);
    setForm({ name: '', slug: '' });
    statsCacheRef.current = { key: '', fetchedAt: 0 };
    fetchClinics();
  };

  const handleDeleteClick = (e: MouseEvent, clinic: ClinicRow) => {
    e.stopPropagation();
    setClinicToDelete(clinic);
    setDeleteDialogOpen(true);
  };

  const handlePauseClick = (e: MouseEvent, clinic: ClinicRow) => {
    e.stopPropagation();
    setClinicToPause(clinic);
    setPauseReason(clinic.pause_reason || '');
    setPauseDialogOpen(true);
  };

  const toggleClinicPaused = async () => {
    if (!clinicToPause) return;
    if (isPausing) return;

    setIsPausing(true);

    const nextPaused = !Boolean(clinicToPause.is_paused);
    const { error } = await supabase
      .from('clinics')
      .update(
        nextPaused
          ? { is_paused: true, paused_at: new Date().toISOString(), pause_reason: pauseReason.trim() || null }
          : { is_paused: false, paused_at: null, pause_reason: null },
      )
      .eq('id', clinicToPause.id);

    if (error) {
      toast({
        title: 'Failed to update clinic',
        description: error.message,
        variant: 'destructive',
      });
      setIsPausing(false);
      return;
    }

    toast({
      title: nextPaused ? 'Clinic disabled' : 'Clinic enabled',
      description: nextPaused
        ? `${clinicToPause.name} has been temporarily disabled.`
        : `${clinicToPause.name} has been enabled again.`,
    });

    setPauseDialogOpen(false);
    setClinicToPause(null);
    setPauseReason('');
    setIsPausing(false);
    statsCacheRef.current = { key: '', fetchedAt: 0 };
    fetchClinics();
  };

  const deleteClinic = async () => {
    if (!clinicToDelete) return;

    setIsDeleting(true);

    const { data, error } = await supabase.rpc('delete_clinic_cascade', {
      target_clinic_id: clinicToDelete.id,
    });

    if (error) {
      toast({
        title: 'Failed to delete clinic',
        description: error.message,
        variant: 'destructive',
      });
      setIsDeleting(false);
      return;
    }

    const summary = data as Record<string, number>;
    const totalRecords = Object.values(summary).reduce((sum, count) => sum + count, 0);

    toast({
      title: 'Clinic deleted',
      description: `${clinicToDelete.name} and ${totalRecords} related records have been permanently deleted`,
    });

    if (activeClinicId === clinicToDelete.id) {
      setActiveClinicId(null);
    }

    setDeleteDialogOpen(false);
    setClinicToDelete(null);
    setIsDeleting(false);
    statsCacheRef.current = { key: '', fetchedAt: 0 };
    fetchClinics();
  };

  return (
    <div className="min-h-screen">
      <Header title="Clinics" subtitle="Manage clinics (MVP)" />

      <div className="p-6 space-y-6 animate-fade-in">
        {setupWarning && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Setup required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>{setupWarning}</div>
              <div>
                Next step: we will add the multi-clinic schema (clinics table + RLS) so this page becomes fully functional.
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${filtered.length} clinic(s)`}
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Search clinics"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[280px]"
            />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>Add Clinic</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create clinic</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="form-label">Clinic Name</label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Slug</label>
                    <Input
                      placeholder="e.g. endicode-clinic"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button onClick={createClinic}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No clinics found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((clinic) => {
              const stats = clinicStats[clinic.id];
              const isActive = activeClinicId === clinic.id;

              return (
                <Card
                  key={clinic.id}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] group relative overflow-hidden"
                  onClick={() => openClinic(clinic)}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                  )}
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{clinic.name}</CardTitle>
                        </div>
                        <p className="text-sm text-muted-foreground">{clinic.admin_email || clinic.slug || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                            Active
                          </Badge>
                        )}
                        {clinic.is_paused ? (
                          <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                            Paused
                          </Badge>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={(e) => handlePauseClick(e, clinic)}
                          title={clinic.is_paused ? 'Enable clinic' : 'Disable clinic'}
                        >
                          {clinic.is_paused ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                        </Button>
                                              </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {isLoadingStats ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        Loading stats...
                      </div>
                    ) : stats ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                              <Users className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Customers</div>
                              <div className="text-lg font-semibold">{stats.customers}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            <div className="h-8 w-8 rounded-md bg-green-500/10 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Invoices</div>
                              <div className="text-lg font-semibold">{stats.invoices}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            <div className="h-8 w-8 rounded-md bg-purple-500/10 flex items-center justify-center">
                              <Users className="h-4 w-4 text-purple-600" />
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Staff</div>
                              <div className="text-lg font-semibold">{stats.staff}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            <div className="h-8 w-8 rounded-md bg-orange-500/10 flex items-center justify-center">
                              <DollarSign className="h-4 w-4 text-orange-600" />
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Outstanding</div>
                              <div className="text-sm font-semibold">Rs. {stats.outstanding.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Created {clinic.created_at ? new Date(clinic.created_at).toLocaleDateString() : '—'}</span>
                            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        Stats unavailable
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Delete dialog temporarily hidden from UI */}
        {/*
        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setClinicToDelete(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Clinic</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to permanently delete this clinic?
              </p>
              <div className="p-3 rounded-lg bg-muted">
                <div className="font-medium">{clinicToDelete?.name || '—'}</div>
                <div className="text-sm text-muted-foreground">{clinicToDelete?.slug || '—'}</div>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium">⚠️ Warning</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete the clinic and all associated data (patients, invoices, payments, appointments, inventory, etc.). This action cannot be undone.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteClinic} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Clinic'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        */}

        <Dialog
          open={pauseDialogOpen}
          onOpenChange={(open) => {
            setPauseDialogOpen(open);
            if (!open) {
              setClinicToPause(null);
              setPauseReason('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{clinicToPause?.is_paused ? 'Enable Clinic' : 'Disable Clinic'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {clinicToPause?.is_paused
                  ? 'Enable this clinic so staff can log in again.'
                  : 'Disable this clinic temporarily. Staff will be blocked from accessing the app.'}
              </p>
              <div className="p-3 rounded-lg bg-muted">
                <div className="font-medium">{clinicToPause?.name || '—'}</div>
                <div className="text-sm text-muted-foreground">{clinicToPause?.slug || '—'}</div>
              </div>

              {!clinicToPause?.is_paused ? (
                <div>
                  <label className="form-label">Reason (optional)</label>
                  <Input value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} />
                </div>
              ) : clinicToPause?.pause_reason ? (
                <div className="text-xs text-muted-foreground">Current reason: {clinicToPause.pause_reason}</div>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPauseDialogOpen(false)} disabled={isPausing}>
                Cancel
              </Button>
              <Button
                variant={clinicToPause?.is_paused ? 'default' : 'destructive'}
                onClick={toggleClinicPaused}
                disabled={isPausing}
              >
                {isPausing ? 'Saving...' : clinicToPause?.is_paused ? 'Enable' : 'Disable'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
