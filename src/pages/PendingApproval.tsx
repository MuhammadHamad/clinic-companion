import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PendingApproval() {
  const { user, logout } = useAuth();
  const { role, isLoading, hasLoadedRole, error } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (error) return;
    if (!role) return;

    if (role === 'super_admin') {
      navigate('/saas', { replace: true });
      return;
    }

    navigate('/', { replace: true });
  }, [error, isLoading, navigate, role]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Avoid rendering the pending UI while tenant state is still loading.
  // This prevents a visible "flash" for approved users.
  if (isLoading || !hasLoadedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If a role exists, we immediately redirect via the effect.
  // Returning null here prevents the pending card from flashing.
  if (!error && role) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Approval Pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Your clinic signup request has been received and is currently pending approval.
          </div>
          {error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : null}
          <div className="text-sm text-muted-foreground">
            Signed in as: <span className="font-medium text-foreground">{user?.email || '—'}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
