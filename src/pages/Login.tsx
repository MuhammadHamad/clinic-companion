import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { BrandMark } from '@/components/BrandMark';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [clinicName, setClinicName] = useState('');
  const [clinicCity, setClinicCity] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const requestedFrom = location.state?.from?.pathname || '/';
  const from =
    !requestedFrom ||
    requestedFrom === '/login' ||
    requestedFrom === '/pending-approval' ||
    requestedFrom.startsWith('/pending-approval/')
      ? '/'
      : requestedFrom;

  const resetAuthForm = () => {
    setShowPassword(false);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setClinicName('');
    setClinicCity('');
    setClinicAddress('');
    setClinicPhone('');
    setOwnerName('');
    setOwnerPhone('');
    setIsForgotPassword(false);
    setResetEmailSent(false);
    setErrors({});
    setFormKey((k) => k + 1);
  };

  const formatPkPhone = (value: string) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  };

  const getPkPhoneDigits = (value: string) => String(value || '').replace(/\D/g, '');

  const isValidPkMobile = (value: string) => {
    const digits = getPkPhoneDigits(value);
    return digits.length === 11 && digits.startsWith('03');
  };

  const isStrongPassword = (value: string) => {
    if (!value || value.length < 8) return false;
    const hasLower = /[a-z]/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);
    return hasLower && hasUpper && hasNumber && hasSpecial;
  };

  const renderStatusBadge = (state: 'ok' | 'bad') => {
    return (
      <div
        className={
          state === 'ok'
            ? 'h-6 w-6 rounded-full bg-success/15 text-success flex items-center justify-center ring-1 ring-success/30'
            : 'h-6 w-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center ring-1 ring-destructive/30'
        }
      >
        {state === 'ok' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </div>
    );
  };

  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = 'Email is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);
    
    try {
      const appUrl = String(import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/+$/, '');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`,
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setResetEmailSent(true);
        toast({
          title: 'Email sent!',
          description: 'Check your inbox for the password reset link.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading) return;

    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = 'Email is required';
    if (!password) nextErrors.password = 'Password is required';

    if (isSignUp) {
      if (!clinicName.trim()) nextErrors.clinicName = 'Clinic name is required';
      if (!clinicCity.trim()) nextErrors.clinicCity = 'City is required';
      if (!clinicPhone.trim()) nextErrors.clinicPhone = 'Clinic phone is required';
      if (!clinicAddress.trim()) nextErrors.clinicAddress = 'Address is required';
      if (!ownerName.trim()) nextErrors.ownerName = 'Owner name is required';
      if (!ownerPhone.trim()) nextErrors.ownerPhone = 'Owner phone is required';
      if (!confirmPassword) nextErrors.confirmPassword = 'Confirm password is required';

      if (clinicPhone.trim() && !isValidPkMobile(clinicPhone)) {
        nextErrors.clinicPhone = 'Enter a valid Pakistani mobile (11 digits, starts with 03) e.g. 0310-9876789';
      }

      if (ownerPhone.trim() && !isValidPkMobile(ownerPhone)) {
        nextErrors.ownerPhone = 'Enter a valid Pakistani mobile (11 digits, starts with 03) e.g. 0310-9876789';
      }
    }

    if (isSignUp) {
      if (password && password.length < 8) {
        nextErrors.password = 'Password must be at least 8 characters';
      } else if (password && !isStrongPassword(password)) {
        nextErrors.password = 'Use a strong password: upper + lower + number + special character';
      }

      if (password && confirmPassword && password !== confirmPassword) {
        nextErrors.confirmPassword = 'Passwords do not match';
      }
    } else if (password && password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsLoading(true);
    
    try {
      if (isSignUp) {
        const redirectUrl = `${window.location.origin}/`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) {
          const msg = String(error.message || '').toLowerCase();
          const isAlreadyRegistered = msg.includes('already registered') || msg.includes('user already registered');
          if (isAlreadyRegistered) {
            const result = await login(email, password);
            if (result.success) {
              toast({
                title: 'Account exists',
                description: 'Signed you in. Redirecting…',
              });
              navigate(from, { replace: true });
              return;
            }

            toast({
              title: 'Account exists',
              description: 'This email is already registered. Please use Sign in instead.',
              variant: 'destructive',
            });
            setIsSignUp(false);
            return;
          }

          toast({
            title: 'Sign up failed',
            description: error.message,
            variant: 'destructive',
          });
          return;
        }

        // Supabase can return a successful response for an already-registered user
        // with an empty identities array. Treat that as "account exists" and do NOT
        // create a new clinic request.
        const identities = (data.user as unknown as { identities?: unknown })?.identities;
        const isExistingUser = Array.isArray(identities) && identities.length === 0;
        if (isExistingUser) {
          const result = await login(email, password);
          if (result.success) {
            toast({
              title: 'Account exists',
              description: 'Signed you in. Redirecting…',
            });
            navigate(from, { replace: true });
            return;
          }

          toast({
            title: 'Account exists',
            description: 'This email is already registered. Please use Sign in instead.',
            variant: 'destructive',
          });
          setIsSignUp(false);
          return;
        }

        const authUserId = data.user?.id || null;

        if (!authUserId) {
          toast({
            title: 'Sign up incomplete',
            description: 'Could not create user account. Please try again.',
            variant: 'destructive',
          });
          return;
        }

        const { error: reqError } = await supabase.from('clinic_requests').insert({
          clinic_name: clinicName.trim(),
          city: clinicCity.trim() || null,
          address: clinicAddress.trim() || null,
          phone: clinicPhone.trim() || null,
          owner_name: ownerName.trim(),
          owner_phone: ownerPhone.trim(),
          owner_email: email.trim(),
          user_email: email.trim(),
          auth_user_id: authUserId,
          status: 'pending',
        });

        if (reqError) {
          const msg = String(reqError.message || 'Request failed');
          const lower = msg.toLowerCase();
          const isDuplicate = lower.includes('already have a clinic request');
          const isPending = lower.includes('already have a pending request');
          const isRateLimited = lower.includes('too many rejected requests');
          const isUniqueViolation =
            lower.includes('duplicate key') ||
            lower.includes('unique constraint') ||
            (reqError as unknown as { code?: string }).code === '23505';

          if (isDuplicate) {
            // Check the user's current request status
            const { data: existingRequest } = await supabase
              .from('clinic_requests')
              .select('status')
              .eq('auth_user_id', authUserId)
              .single();

            if (existingRequest) {
              if (existingRequest.status === 'approved') {
                toast({
                  title: 'Already approved',
                  description: 'Your clinic has already been approved. Please sign in to access your dashboard.',
                });
              } else if (existingRequest.status === 'pending') {
                toast({
                  title: 'Request pending',
                  description: 'Your clinic request is still pending approval. Please check your email or wait for admin approval.',
                });
              } else if (existingRequest.status === 'rejected') {
                toast({
                  title: 'Request rejected',
                  description: 'Your clinic request was rejected. Please contact support for assistance.',
                });
              }
            } else {
              toast({
                title: 'Account exists',
                description: 'You already have an account. Please sign in.',
              });
            }
            setIsSignUp(false);
            resetAuthForm();
            return;
          }

          if (isPending || isUniqueViolation) {
            toast({
              title: 'Request already submitted',
              description: 'You already have a pending request. Please wait for approval.',
              variant: 'destructive',
            });
            setIsSignUp(false);
            resetAuthForm();
            return;
          }

          toast({
            title: 'Account created, but request failed',
            description: isPending
              ? 'You already have a pending request. Please wait for approval or use the Pending Approval screen to refresh.'
              : isRateLimited
                ? 'Your request was rejected too many times. Please use a different email or contact support.'
                : msg,
            variant: 'destructive',
          });
          return;
        }

        if (isSignUp) {
          toast({
            title: 'Account created!',
            description: 'Please check your email to verify your account. Your clinic will be reviewed by the admin.',
          });

          setIsSignUp(false);
          resetAuthForm();
          return;
        }
      }

      const result = await login(email, password);
      
      if (result.success) {
        try {
          sessionStorage.setItem('post_login_toast', '1');
        } catch {
          // ignore
        }
        navigate(from, { replace: true });
      } else {
        toast({
          title: 'Login failed',
          description: result.error || 'Invalid credentials',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    if (isForgotPassword) return 'Reset password';
    if (isSignUp) return 'Create an account';
    return 'Welcome back';
  };

  const getSubtitle = () => {
    if (isForgotPassword) return "Enter your email and we'll send you a reset link";
    if (isSignUp) return 'Sign up to get started';
    return 'Sign in to your account to continue';
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary to-primary/80 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <BrandMark className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Endicode Clinic</h1>
              <p className="text-sm text-white/70">Clinic Management System</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-4xl font-display font-bold text-white leading-tight">
            Streamline Your<br />Clinic Operations
          </h2>
          <p className="text-lg text-white/80 max-w-md">
            Manage patients, appointments, invoices, and inventory all in one place. 
            Built for clinics in Pakistan.
          </p>
          <div className="flex gap-6 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span>Patient Management</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span>Appointment Scheduling</span>
            </div>
          </div>
        </div>

        <div className="relative text-sm text-white/50">
          2024 Endicode Clinic. All rights reserved.
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <BrandMark className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Endicode Clinic</h1>
              <p className="text-sm text-muted-foreground">Clinic Management</p>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-display font-bold text-foreground">
              {getTitle()}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {getSubtitle()}
            </p>
          </div>

          {isForgotPassword ? (
            resetEmailSent ? (
              <div className="space-y-6 text-center">
                <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                  <p className="text-success font-medium">Check your email!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We've sent a password reset link to {email}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetEmailSent(false);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="form-label">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  {!!errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      <span>Sending...</span>
                    </div>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setShowPassword(false);
                      setPassword('');
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="clinicName" className="form-label">
                        Clinic Name
                      </label>
                      <Input
                        id="clinicName"
                        placeholder="e.g. Endicode Clinic"
                        value={clinicName}
                        onChange={(e) => {
                          setClinicName(e.target.value);
                          clearFieldError('clinicName');
                        }}
                        disabled={isLoading}
                      />
                      {!!errors.clinicName && (
                        <p className="text-sm text-destructive">{errors.clinicName}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="clinicCity" className="form-label">
                          City
                        </label>
                        <Input
                          id="clinicCity"
                          placeholder="e.g. Lahore"
                          value={clinicCity}
                          onChange={(e) => {
                            setClinicCity(e.target.value);
                            clearFieldError('clinicCity');
                          }}
                          disabled={isLoading}
                        />
                        {!!errors.clinicCity && (
                          <p className="text-sm text-destructive">{errors.clinicCity}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="clinicPhone" className="form-label">
                          Clinic phone
                        </label>
                        <Input
                          id="clinicPhone"
                          inputMode="numeric"
                          maxLength={12}
                          placeholder="e.g. 03xx-xxxxxxx"
                          value={clinicPhone}
                          onChange={(e) => {
                            setClinicPhone(formatPkPhone(e.target.value));
                            clearFieldError('clinicPhone');
                          }}
                          disabled={isLoading}
                        />
                        {!!errors.clinicPhone && (
                          <p className="text-sm text-destructive">{errors.clinicPhone}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="clinicAddress" className="form-label">
                        Address
                      </label>
                      <Input
                        id="clinicAddress"
                        placeholder="e.g. Model Town, Street 5"
                        value={clinicAddress}
                        onChange={(e) => {
                          setClinicAddress(e.target.value);
                          clearFieldError('clinicAddress');
                        }}
                        disabled={isLoading}
                      />
                      {!!errors.clinicAddress && (
                        <p className="text-sm text-destructive">{errors.clinicAddress}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="ownerName" className="form-label">
                          Owner name
                        </label>
                        <Input
                          id="ownerName"
                          placeholder="e.g. Dr. Ali"
                          value={ownerName}
                          onChange={(e) => {
                            setOwnerName(e.target.value);
                            clearFieldError('ownerName');
                          }}
                          disabled={isLoading}
                        />
                        {!!errors.ownerName && (
                          <p className="text-sm text-destructive">{errors.ownerName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="ownerPhone" className="form-label">
                          Owner phone
                        </label>
                        <Input
                          id="ownerPhone"
                          inputMode="numeric"
                          maxLength={12}
                          placeholder="e.g. 03xx-xxxxxxx"
                          value={ownerPhone}
                          onChange={(e) => {
                            setOwnerPhone(formatPkPhone(e.target.value));
                            clearFieldError('ownerPhone');
                          }}
                          disabled={isLoading}
                        />
                        {!!errors.ownerPhone && (
                          <p className="text-sm text-destructive">{errors.ownerPhone}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="form-label">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      key={`email-${formKey}`}
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  {!!errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setShowPassword(false);
                          setPassword('');
                        }}
                        className="text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      key={`password-${formKey}`}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                      }}
                      className={isSignUp ? 'pl-10 pr-20' : 'pl-10 pr-10'}
                      disabled={isLoading}
                    />

                    {isSignUp && password.length > 0 && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2">
                        {renderStatusBadge(isStrongPassword(password) ? 'ok' : 'bad')}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {!!errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                {isSignUp && (
                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="form-label">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          clearFieldError('confirmPassword');
                        }}
                        className="pl-10 pr-20"
                        disabled={isLoading}
                      />

                      {confirmPassword.length > 0 && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2">
                          {renderStatusBadge(
                            isStrongPassword(password) && password === confirmPassword ? 'ok' : 'bad',
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {!!errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                    </div>
                  ) : (
                    isSignUp ? 'Create account' : 'Sign in'
                  )}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isSignUp;
                    setIsSignUp(next);
                    setIsForgotPassword(false);
                    setResetEmailSent(false);
                    setShowPassword(false);
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                    setClinicName('');
                    setClinicCity('');
                    setClinicAddress('');
                    setClinicPhone('');
                    setOwnerName('');
                    setOwnerPhone('');
                    setErrors({});
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
