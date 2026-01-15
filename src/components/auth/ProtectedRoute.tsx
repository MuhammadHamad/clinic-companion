import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { role, clinicId, isLoading: isTenantLoading, hasLoadedRole, error } = useTenant();
  const location = useLocation();
  const { toast } = useToast();
  const didToastRef = useRef(false);

  const isOrphan = role && role !== 'super_admin' && !clinicId;
  const hasAppAccess = Boolean(role && !isOrphan);

  useEffect(() => {
    if (didToastRef.current) return;
    if (!isAuthenticated) return;
    if (isLoading || isTenantLoading || !hasLoadedRole) return;
    if (error) return;
    if (!hasAppAccess) return;

    let shouldToast = false;
    try {
      shouldToast = sessionStorage.getItem('post_login_toast') === '1';
    } catch {
      shouldToast = false;
    }

    if (!shouldToast) return;

    didToastRef.current = true;
    try {
      sessionStorage.removeItem('post_login_toast');
    } catch {
      // ignore
    }

    toast({
      title: 'Welcome back!',
      description: 'You have successfully logged in',
    });
  }, [error, hasAppAccess, hasLoadedRole, isAuthenticated, isLoading, isTenantLoading, toast]);

  if (isLoading || (isAuthenticated && (isTenantLoading || !hasLoadedRole))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-lg font-semibold">Role lookup failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The app couldn’t load your access role from the database. This is usually caused by a database security policy
            (RLS) misconfiguration.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{error}</p>
          <div className="mt-4 flex gap-2">
            <button
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload
            </button>
            <button
              className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium"
              onClick={() => window.location.href = '/login'}
              type="button"
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Only redirect to pending approval if:
  // 1. User has no role at all
  // 2. User is NOT a super_admin AND has no clinic_id (orphaned user)
  
  if ((!role || isOrphan) && location.pathname !== '/pending-approval') {
    return <Navigate to="/pending-approval" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}