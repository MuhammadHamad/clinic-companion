import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks';
import { getPublicAppUrl } from '@/lib/appUrl';

export default function PendingApproval() {
  const { user, logout } = useAuth();
  const { role, clinicId, isLoading, hasLoadedRole, error } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [requestLoading, setRequestLoading] = useState(false);
  const [hasLoadedRequest, setHasLoadedRequest] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [latestRequest, setLatestRequest] = useState<{
    status: 'pending' | 'approved' | 'rejected' | string;
    clinic_name: string | null;
    city: string | null;
    address: string | null;
    phone: string | null;
    owner_name: string | null;
    owner_phone: string | null;
    owner_email: string | null;
    user_email: string | null;
  } | null>(null);

  const loadedForUserRef = useRef<string | null>(null);
  const requestSeqRef = useRef(0);

  const isOrphan = Boolean(role && role !== 'super_admin' && !clinicId);

  useEffect(() => {
    // Reset request state when auth user changes to avoid stale flashes.
    loadedForUserRef.current = null;
    requestSeqRef.current = 0;
    setLatestRequest(null);
    setRequestError(null);
    setHasLoadedRequest(false);
    setRequestLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (isLoading) return;
    if (error) return;
    if (!role || isOrphan) return;

    if (role === 'super_admin') {
      navigate('/saas', { replace: true });
      return;
    }

    navigate('/', { replace: true });
  }, [error, isLoading, isOrphan, navigate, role]);

  const loadLatestRequest = useCallback(
    async (force = false) => {
      if (!user?.id) return;

      if (!force && hasLoadedRequest && loadedForUserRef.current === user.id) {
        return;
      }

      const seq = (requestSeqRef.current += 1);

      setRequestLoading(true);
      setRequestError(null);

      const query = supabase
        .from('clinic_requests')
        .select(
          'status, clinic_name, city, address, phone, owner_name, owner_phone, owner_email, user_email',
        );

      const { data, error: reqError } = await (user.email
        ? query.or(`auth_user_id.eq.${user.id},user_email.eq.${user.email}`)
        : query.eq('auth_user_id', user.id))
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1);

      if (seq !== requestSeqRef.current) {
        return;
      }

      if (reqError) {
        setLatestRequest(null);
        setRequestError(reqError.message || 'Failed to load request status');
        setRequestLoading(false);
        setHasLoadedRequest(true);
        loadedForUserRef.current = user.id;
        return;
      }

      const row = (data || [])[0] || null;
      setLatestRequest(row);
      setRequestLoading(false);
      setHasLoadedRequest(true);
      loadedForUserRef.current = user.id;
    },
    [hasLoadedRequest, user?.email, user?.id],
  );

  useEffect(() => {
    // Only relevant if user has no role (otherwise the effect above redirects away)
    if ((!role || isOrphan) && hasLoadedRole && !isLoading) {
      loadLatestRequest(false);
    }
  }, [hasLoadedRole, isLoading, isOrphan, loadLatestRequest, role]);

  const requestStatus = useMemo(() => {
    const s = String(latestRequest?.status || '').toLowerCase();
    return s;
  }, [latestRequest?.status]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleResendVerification = async () => {
    const email = user?.email;
    if (!email) {
      toast({
        title: 'Email not available',
        description: 'Please log out and sign in again, then try resending the verification email.',
        variant: 'destructive',
      });
      return;
    }

    if (isResending) return;
    setIsResending(true);

    try {
      // Try multiple approaches to resend verification
      const redirectUrl = `${getPublicAppUrl()}/`;
      
      // Method 1: Standard resend
      let { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectUrl },
      });

      // If method 1 fails, try method 2: email change to same email (triggers verification)
      if (resendError) {
        const { error: changeError } = await supabase.auth.updateUser({
          email: email,
        });

        if (!changeError) {
          resendError = null;
        }
      }

      if (resendError) {
        toast({
          title: 'Resend failed',
          description: `${resendError.message}. Please check your Supabase email configuration or contact support.`,
          variant: 'destructive',
        });
        setIsResending(false);
        return;
      }

      toast({
        title: 'Verification email sent',
        description: 'Please check your inbox and spam/junk folder. If you still don\'t see it, the email service may be misconfigured.',
      });
    } catch (error: any) {
      toast({
        title: 'Resend failed',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleReapply = async () => {
    if (!user?.id) return;
    if (!latestRequest) {
      toast({
        title: 'Cannot re-apply',
        description: 'No previous request details were found for your account.',
        variant: 'destructive',
      });
      return;
    }

    setRequestLoading(true);
    setRequestError(null);

    const { error: insertError } = await supabase.from('clinic_requests').insert({
      clinic_name: String(latestRequest.clinic_name || '').trim() || 'Clinic',
      city: latestRequest.city,
      address: latestRequest.address,
      phone: latestRequest.phone,
      owner_name: latestRequest.owner_name,
      owner_phone: latestRequest.owner_phone,
      owner_email: latestRequest.owner_email,
      user_email: latestRequest.user_email || user.email || null,
      auth_user_id: user.id,
      status: 'pending',
    });

    if (insertError) {
      const msg = String(insertError.message || 'Failed to submit a new request');
      const lower = msg.toLowerCase();
      const isPending = lower.includes('already have a pending request');
      const isRateLimited = lower.includes('too many rejected requests');

      setRequestLoading(false);
      setRequestError(
        isPending
          ? 'You already have a pending request. Please wait for approval.'
          : isRateLimited
            ? 'Your request was rejected too many times. Please use a different email or contact support.'
            : msg,
      );
      toast({
        title: 'Re-apply failed',
        description: isPending
          ? 'You already have a pending request. Please wait for approval.'
          : isRateLimited
            ? 'Your request was rejected too many times. Please use a different email or contact support.'
            : msg,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Re-applied',
      description: 'A new approval request has been submitted.',
    });

    setRequestLoading(false);
    await loadLatestRequest(true);
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
  if (!error && role && !isOrphan) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            {requestLoading || !hasLoadedRequest
              ? 'Checking request status'
              : requestError
                ? 'Request status unavailable'
                : !latestRequest
                  ? 'Request not found'
                  : requestStatus === 'rejected'
                    ? 'Request Rejected'
                    : 'Approval Pending'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {requestLoading || !hasLoadedRequest ? (
            <div className="text-sm text-muted-foreground">Loading request status…</div>
          ) : requestError ? (
            <div className="text-sm text-destructive">{requestError}</div>
          ) : !latestRequest ? (
            <div className="text-sm text-muted-foreground">
              No request was found for this account. Please sign up again.
            </div>
          ) : requestStatus === 'rejected' ? (
            <div className="text-sm text-muted-foreground">
              Your clinic signup request was rejected by an administrator.
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Your clinic signup request has been received and is currently pending approval.
            </div>
          )}

          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          <div className="text-sm text-muted-foreground">
            Signed in as: <span className="font-medium text-foreground">{user?.email || '—'}</span>
          </div>
          <div className="flex gap-2">
            {!requestLoading && hasLoadedRequest && !requestError && !!latestRequest && requestStatus === 'rejected' ? (
              <Button onClick={handleReapply} disabled={requestLoading}>
                Re-apply
              </Button>
            ) : (
              <Button variant="outline" onClick={() => loadLatestRequest(true)} disabled={requestLoading}>
                Refresh
              </Button>
            )}
            <Button variant="outline" onClick={handleResendVerification} disabled={isResending}>
              {isResending ? 'Sending…' : 'Resend email'}
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
