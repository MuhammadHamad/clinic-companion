import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks';

type ClinicRequestRow = {
  id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  clinic_name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  user_email: string | null;
  auth_user_id: string | null;
};

export default function SaasClinicRequests() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ClinicRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState<ClinicRequestRow | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const fetchRequests = async () => {
    setIsLoading(true);
    setSetupWarning(null);

    const { data, error } = await supabase
      .from('clinic_requests')
      .select(
        'id, created_at, status, clinic_name, city, address, phone, owner_name, owner_phone, owner_email, user_email, auth_user_id',
      )
      .order('created_at', { ascending: false });

    if (error) {
      setRows([]);
      setSetupWarning('Clinic requests table is not accessible yet (missing table or RLS policy).');
    } else {
      setRows((data || []) as ClinicRequestRow[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.clinic_name,
        r.city || '',
        r.phone || '',
        r.owner_name || '',
        r.owner_phone || '',
        r.owner_email || '',
        r.user_email || '',
        r.status || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const approveRequest = async (req: ClinicRequestRow) => {
    if (isWorking) return;
    if (!req.auth_user_id) {
      toast({
        title: 'Cannot approve',
        description: 'This request has no auth_user_id. Ask the clinic to sign up again.',
        variant: 'destructive',
      });
      return;
    }

    setIsWorking(true);
    try {
      const baseSlug = String(req.clinic_name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 45); // leave room for suffix

      let clinicRow: { id: string } | null = null;
      let clinicError: any = null;
      let slug = baseSlug || `clinic-${Date.now()}`;

      // Retry with random suffix on duplicate slug (up to 3 attempts)
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const attemptSlug = attempt === 0 ? slug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const { data, error } = await supabase
          .from('clinics')
          .insert({
            name: req.clinic_name.trim(),
            slug: attemptSlug,
          })
          .select('id')
          .single();

        if (!error && data) {
          clinicRow = data;
          slug = attemptSlug;
          break;
        }
        clinicError = error;
        // If it's not a unique violation, no point retrying
        if (!error?.message?.includes('duplicate key') && !error?.message?.includes('unique')) {
          break;
        }
      }

      if (!clinicRow) {
        toast({
          title: 'Failed to create clinic',
          description: clinicError?.message || 'Unknown error',
          variant: 'destructive',
        });
        return;
      }

      const { error: roleError } = await supabase.from('user_roles').upsert({
        user_id: req.auth_user_id,
        role: 'admin',
        clinic_id: clinicRow.id,
      });

      if (roleError) {
        toast({
          title: 'Failed to link user',
          description: roleError.message,
          variant: 'destructive',
        });
        return;
      }

      const { error: reqError } = await supabase
        .from('clinic_requests')
        .update({ status: 'approved' })
        .eq('id', req.id);

      if (reqError) {
        toast({
          title: 'Approved, but status update failed',
          description: reqError.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Approved',
        description: 'Clinic request approved and user linked as admin.',
      });

      fetchRequests();
    } finally {
      setIsWorking(false);
    }
  };

  const rejectRequest = async () => {
    if (!rejecting) return;
    if (isWorking) return;

    setIsWorking(true);
    try {
      const base = supabase.from('clinic_requests').update({ status: 'rejected' });

      const authUserId = rejecting.auth_user_id;
      const userEmail = rejecting.user_email;

      // Reject the selected request AND any other pending requests for the same user.
      // This prevents a rejected user from still having another "pending" row that makes the app show "Approval Pending".
      const { error } = await (authUserId
        ? base.or(`id.eq.${rejecting.id},auth_user_id.eq.${authUserId}`).eq('status', 'pending')
        : userEmail
          ? base.or(`id.eq.${rejecting.id},user_email.eq.${userEmail}`).eq('status', 'pending')
          : base.eq('id', rejecting.id));

      if (error) {
        toast({
          title: 'Failed to reject',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Rejected',
        description: 'Clinic request rejected.',
      });

      setIsRejectOpen(false);
      setRejecting(null);
      fetchRequests();
    } finally {
      setIsWorking(false);
    }
  };

  const statusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending') return <Badge variant="secondary">pending</Badge>;
    if (s === 'approved') return <Badge className="bg-success text-success-foreground">approved</Badge>;
    if (s === 'rejected') return <Badge variant="destructive">rejected</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="min-h-screen">
      <Header title="Clinic Requests" subtitle="Approve or reject new clinic signups" />

      <div className="p-6 space-y-6 animate-fade-in">
        {setupWarning && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Setup required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>{setupWarning}</div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${filtered.length} request(s)`}
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search clinic/owner/email/status"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[280px]"
            />
            <Button variant="outline" onClick={fetchRequests} disabled={isLoading || isWorking}>
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div>{r.clinic_name}</div>
                        <div className="text-xs text-muted-foreground">{[r.city, r.address].filter(Boolean).join(' • ') || '—'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.owner_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.owner_email || r.user_email || '—'}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{r.phone || '—'}</div>
                        <div className="text-xs">{r.owner_phone || '—'}</div>
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveRequest(r)}
                            disabled={isWorking || String(r.status).toLowerCase() !== 'pending'}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejecting(r);
                              setIsRejectOpen(true);
                            }}
                            disabled={isWorking || String(r.status).toLowerCase() !== 'pending'}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isRejectOpen}
        onOpenChange={(open) => {
          setIsRejectOpen(open);
          if (!open) setRejecting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Clinic</Label>
              <div className="text-sm text-muted-foreground">{rejecting?.clinic_name || '—'}</div>
            </div>
            <div>
              <Label>Owner</Label>
              <div className="text-sm text-muted-foreground">{rejecting?.owner_name || '—'}</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)} disabled={isWorking}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={rejectRequest} disabled={isWorking}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
