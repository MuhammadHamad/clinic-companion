import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks';
import type { AppRole } from '@/contexts/TenantContext';
import { clinicUsersApi } from '@/lib/clinicUsersApi';

type ClinicUserRow = {
  user_id: string;
  role: AppRole;
  created_at: string | null;
  email: string | null;
  first_name: unknown;
  last_name: unknown;
};

export default function Users() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isLoading: isRoleLoading, isAdmin } = useUserRole();

  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<ClinicUserRow[]>(() => {
    const cached = clinicUsersApi.getCachedList();
    return (cached?.users || []) as ClinicUserRow[];
  });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removeState, setRemoveState] = useState<{ open: boolean; user: ClinicUserRow | null }>({ open: false, user: null });
  const [isRemoving, setIsRemoving] = useState(false);
  const [roleChangeState, setRoleChangeState] = useState<{ open: boolean; user: ClinicUserRow | null; nextRole: Exclude<AppRole, 'super_admin'> | null }>({
    open: false,
    user: null,
    nextRole: null,
  });
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [addForm, setAddForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'receptionist' as Exclude<AppRole, 'super_admin'>,
  });
  const [showAddPasswords, setShowAddPasswords] = useState(false);

  const fetchUsers = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) setIsLoading(true);
    try {
      const res = await clinicUsersApi.list();
      const next = (res.users || []) as ClinicUserRow[];
      setUsers(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load users';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      if (!silent) setUsers([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isRoleLoading && isAdmin) {
      // Stale-while-revalidate: if we already have cached rows, refresh silently.
      if (users.length > 0) {
        void fetchUsers({ silent: true });
      } else {
        fetchUsers();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoleLoading, isAdmin]);

  const slotsInfo = useMemo(() => {
    // Limit is 3 total users per clinic INCLUDING the admin running this screen.
    // The API list may already include the admin, so count unique user_ids.
    const ids = new Set<string>();
    for (const u of users) {
      if (u?.user_id) ids.add(u.user_id);
    }
    if (user?.id) ids.add(user.id);
    const used = ids.size;
    const max = 3;
    return { used, max, remaining: Math.max(0, max - used) };
  }, [users, user?.id]);

  if (isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleCreate = async () => {
    const email = addForm.email.trim();
    const password = addForm.password;
    const confirmPassword = addForm.confirmPassword;
    const role = addForm.role;

    if (!email) {
      toast({ title: 'Missing email', description: 'Please enter an email address.', variant: 'destructive' });
      return;
    }

    if (!password || password.length < 6) {
      toast({ title: 'Weak password', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Please confirm the password correctly.', variant: 'destructive' });
      return;
    }

    if (slotsInfo.used >= slotsInfo.max) {
      toast({ title: 'Limit reached', description: 'Clinic user limit reached (max 3 users per clinic).', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await clinicUsersApi.create({ email, password, role });
      setIsAddOpen(false);
      setAddForm({ email: '', password: '', confirmPassword: '', role: 'receptionist' });
      setUsers((prev) => {
        const nextRow: ClinicUserRow = {
          user_id: created.user_id,
          role: created.role,
          created_at: new Date().toISOString(),
          email,
          first_name: null,
          last_name: null,
        };
        if (prev.some((u) => u.user_id === created.user_id)) return prev;
        return [nextRow, ...prev];
      });
      void fetchUsers({ silent: true });
      toast({ title: 'User created', description: 'The new user can now sign in with the provided credentials.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create user';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: Exclude<AppRole, 'super_admin'>, prevRole: Exclude<AppRole, 'super_admin'>) => {
    setIsUpdatingRole(true);
    setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role } : u)));
    try {
      await clinicUsersApi.updateRole({ userId, role });
      void fetchUsers({ silent: true });
      toast({ title: 'Role updated', description: 'User role updated successfully.' });
    } catch (e) {
      setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role: prevRole } : u)));
      const msg = e instanceof Error ? e.message : 'Failed to update role';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setIsRemoving(true);
    const snapshot = users;
    setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    try {
      await clinicUsersApi.remove({ userId });
      void fetchUsers({ silent: true });
      toast({ title: 'User removed', description: 'User access was removed from this clinic.' });
    } catch (e) {
      setUsers(snapshot);
      const msg = e instanceof Error ? e.message : 'Failed to remove user';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsRemoving(false);
      setRemoveState({ open: false, user: null });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Users" subtitle="Create and manage clinic users (max 3 users per clinic)." />

      <AlertDialog
        open={removeState.open}
        onOpenChange={(open) => {
          if (isRemoving) return;
          setRemoveState((p) => ({ ...p, open, user: open ? p.user : null }));
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              {removeState.user?.email
                ? `Are you sure you want to permanently delete "${removeState.user.email}"? This action cannot be undone.`
                : 'Are you sure you want to permanently delete this user? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemoving || !removeState.user}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!removeState.user) return;
                void handleRemove(removeState.user.user_id);
              }}
            >
              {isRemoving ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={roleChangeState.open}
        onOpenChange={(open) => {
          if (isUpdatingRole) return;
          setRoleChangeState((p) => ({ ...p, open, user: open ? p.user : null, nextRole: open ? p.nextRole : null }));
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm role change</AlertDialogTitle>
            <AlertDialogDescription>
              {roleChangeState.user?.email
                ? `Change role for "${roleChangeState.user.email}" to "${roleChangeState.nextRole || ''}"?`
                : 'Change this user\'s role?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingRole}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUpdatingRole || !roleChangeState.user || !roleChangeState.nextRole}
              onClick={(e) => {
                e.preventDefault();
                const target = roleChangeState.user;
                const nextRole = roleChangeState.nextRole;
                if (!target || !nextRole) return;
                setRoleChangeState({ open: false, user: null, nextRole: null });
                void handleUpdateRole(target.user_id, nextRole, target.role as Exclude<AppRole, 'super_admin'>);
              }}
            >
              {isUpdatingRole ? 'Updating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-4 sm:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>User limit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="text-sm text-muted-foreground">Used: {slotsInfo.used} / {slotsInfo.max}</div>
              <div className="text-sm text-muted-foreground">Remaining: {slotsInfo.remaining}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Clinic users</CardTitle>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button type="button" disabled={slotsInfo.used >= slotsInfo.max}>Add user</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add user</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="user@clinic.com"
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="flex gap-2">
                      <Input
                        id="password"
                        type={showAddPasswords ? 'text' : 'password'}
                        value={addForm.password}
                        onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddPasswords((v) => !v)}
                        aria-label={showAddPasswords ? 'Hide password' : 'Show password'}
                      >
                        {showAddPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type={showAddPasswords ? 'text' : 'password'}
                      value={addForm.confirmPassword}
                      onChange={(e) => setAddForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={addForm.role} onValueChange={(v) => setAddForm((p) => ({ ...p, role: v as Exclude<AppRole, 'super_admin'> }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receptionist">Receptionist</SelectItem>
                        <SelectItem value="dentist">Dentist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="button" onClick={handleCreate} disabled={isSubmitting}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">Loading...</TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">No users found</TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => {
                      const isSelf = Boolean(user?.id && u.user_id === user.id);
                      return (
                        <TableRow key={u.user_id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{u.email || u.user_id}</span>
                              {isSelf && <span className="text-xs text-muted-foreground">(You)</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={u.role}
                              onValueChange={(v) => {
                                const nextRole = v as Exclude<AppRole, 'super_admin'>;
                                if (nextRole === (u.role as Exclude<AppRole, 'super_admin'>)) return;
                                setRoleChangeState({ open: true, user: u, nextRole });
                              }}
                              disabled={isSelf || isUpdatingRole}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="receptionist">Receptionist</SelectItem>
                                <SelectItem value="dentist">Dentist</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setRemoveState({ open: true, user: u })}
                              disabled={isSelf}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
