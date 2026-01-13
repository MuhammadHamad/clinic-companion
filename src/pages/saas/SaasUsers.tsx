import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/contexts/TenantContext';

type UserRoleRow = {
  user_id: string;
  role: AppRole;
  clinic_id?: string | null;
  created_at?: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ClinicRow = {
  id: string;
  name: string;
  slug?: string | null;
};

export default function SaasUsers() {
  const { toast } = useToast();
  const [rows, setRows] = useState<UserRoleRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [setupWarning, setSetupWarning] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [clinicFilter, setClinicFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', role: 'receptionist' as AppRole, clinicId: '' });
  const [isCreating, setIsCreating] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setSetupWarning(null);

    const [rolesRes, profilesRes, clinicsRes] = await Promise.all([
      supabase
        .from('user_roles')
        .select('user_id, role, clinic_id, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, email, first_name, last_name'),
      supabase
        .from('clinics')
        .select('id, name, slug')
        .order('created_at', { ascending: false }),
    ]);

    if (rolesRes.error) {
      setRows([]);
      setSetupWarning('User roles are not accessible yet (RLS policy likely restricts reading user_roles).');
    } else {
      const next = (rolesRes.data || []) as UserRoleRow[];
      setRows(next.filter((r) => r.role === 'super_admin' || Boolean(r.clinic_id)));
    }

    if (profilesRes.error) {
      setProfiles([]);
      setSetupWarning((prev) => prev || 'Profiles are not accessible yet (profiles table or RLS may be missing).');
    } else {
      setProfiles((profilesRes.data || []) as ProfileRow[]);
    }

    if (clinicsRes.error) {
      setClinics([]);
      setSetupWarning((prev) => prev || 'Clinics are not accessible yet (clinics table or RLS may be missing).');
    } else {
      setClinics((clinicsRes.data || []) as ClinicRow[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const profilesById = new Map(profiles.map((p) => [p.id, p]));
    const clinicsById = new Map(clinics.map((c) => [c.id, c]));

    return rows
      .filter((r) => (roleFilter === 'all' ? true : r.role === roleFilter))
      .filter((r) => (clinicFilter === 'all' ? true : (r.clinic_id || '') === clinicFilter))
      .filter((r) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;

        const p = profilesById.get(r.user_id);
        const email = (p?.email || '').toLowerCase();
        const name = `${p?.first_name || ''} ${p?.last_name || ''}`.trim().toLowerCase();
        const clinicName = (r.clinic_id ? (clinicsById.get(r.clinic_id)?.name || '') : '').toLowerCase();

        return r.user_id.toLowerCase().includes(q) || email.includes(q) || name.includes(q) || clinicName.includes(q);
      })
      .map((r) => ({
        ...r,
        profile: profilesById.get(r.user_id) || null,
        clinic: r.clinic_id ? (clinicsById.get(r.clinic_id) || null) : null,
      }));
  }, [rows, profiles, clinics, roleFilter, clinicFilter, search]);

  const updateRole = async (userId: string, nextRole: AppRole) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role: nextRole })
      .eq('user_id', userId);

    if (error) {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Role updated',
      description: 'User role has been updated successfully',
    });

    setRows((prev) => prev.map((r) => (r.user_id === userId ? { ...r, role: nextRole } : r)));
  };

  const updateClinic = async (userId: string, nextClinicId: string | null) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ clinic_id: nextClinicId })
      .eq('user_id', userId);

    if (error) {
      toast({
        title: 'Failed to update clinic',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Clinic updated',
      description: 'User clinic has been updated successfully',
    });

    setRows((prev) => prev.map((r) => (r.user_id === userId ? { ...r, clinic_id: nextClinicId } : r)));
  };

  const createUser = async () => {
    if (!addForm.email.trim() || !addForm.clinicId) {
      toast({
        title: 'Validation error',
        description: 'Email and clinic are required. Make sure the user already exists in Supabase Auth.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    // 1) Find existing auth user by email in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', addForm.email.trim())
      .single();

    if (profileError || !profile) {
      toast({
        title: 'User not found',
        description: 'No existing auth user with this email. Please create the user in Supabase Auth first.',
        variant: 'destructive',
      });
      setIsCreating(false);
      return;
    }

    // 2) Insert user_roles row linking that user to clinic and role
    const { error: roleError } = await supabase.from('user_roles').upsert(
      {
        user_id: profile.id,
        role: addForm.role,
        clinic_id: addForm.clinicId,
      },
      { onConflict: 'user_id' },
    );

    if (roleError) {
      toast({
        title: 'Role assignment failed',
        description: roleError.message,
        variant: 'destructive',
      });
      setIsCreating(false);
      return;
    }

    toast({
      title: 'User linked',
      description: 'Existing user has been assigned to the clinic and role.',
    });

    setIsAddDialogOpen(false);
    setAddForm({ email: '', role: 'receptionist', clinicId: '' });
    fetchUsers();

    setIsCreating(false);
  };

  return (
    <div className="min-h-screen">
      <Header title="Users" subtitle="Manage user roles (MVP)" />

      <div className="p-6 space-y-6 animate-fade-in">
        {setupWarning && (
          <Card className="border-warning/30 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Setup required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>{setupWarning}</div>
              <div>
                Next step: we will add a super_admin RLS policy on user_roles so this page can list and manage all users.
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div className="flex gap-3">
            <Input
              placeholder="Search by name, email, clinic, or user_id"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="dentist">Dentist</SelectItem>
                <SelectItem value="receptionist">Receptionist</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={clinicFilter} onValueChange={setClinicFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Clinic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clinics</SelectItem>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>Add User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create User</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Role</Label>
                    <Select value={addForm.role} onValueChange={(v) => setAddForm({ ...addForm, role: v as AppRole })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="dentist">Dentist</SelectItem>
                        <SelectItem value="receptionist">Receptionist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Clinic</Label>
                    <Select value={addForm.clinicId} onValueChange={(v) => setAddForm({ ...addForm, clinicId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select clinic" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinics.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={createUser} disabled={isCreating}>
                    {isCreating ? 'Creating…' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {u.profile
                              ? `${u.profile.first_name || ''} ${u.profile.last_name || ''}`.trim() || '—'
                              : '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {u.profile?.email || u.user_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{u.role}</TableCell>
                      <TableCell>
                        {u.role === 'super_admin' ? (
                          <span className="text-sm text-muted-foreground">All clinics</span>
                        ) : u.clinic ? (
                          <span className="text-sm">{u.clinic.name}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.created_at ? new Date(u.created_at).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={u.role}
                          onValueChange={(v) => updateRole(u.user_id, v as AppRole)}
                        >
                          <SelectTrigger className="inline-flex w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="dentist">Dentist</SelectItem>
                            <SelectItem value="receptionist">Receptionist</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
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
