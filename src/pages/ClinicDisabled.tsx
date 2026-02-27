import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

export default function ClinicDisabled() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { activeClinic, clinicPauseReason, clinicPausedAt } = useTenant();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Clinic Disabled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            This clinic has been temporarily disabled by the administrator.
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="font-medium">Clinic</div>
            <div className="text-muted-foreground">{activeClinic?.name || '—'}</div>
          </div>

          {clinicPausedAt ? (
            <div className="text-xs text-muted-foreground">Disabled at: {new Date(clinicPausedAt).toLocaleString()}</div>
          ) : null}

          {clinicPauseReason ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <div className="font-medium">Reason</div>
              <div className="text-muted-foreground">{clinicPauseReason}</div>
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">Signed in as: {user?.email || '—'}</div>

          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
