import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Stethoscope, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    setClinicName('');
    setClinicCity('');
    setClinicAddress('');
    setClinicPhone('');
    setOwnerName('');
    setOwnerPhone('');
    setIsForgotPassword(false);
    setResetEmailSent(false);
    setFormKey((k) => k + 1);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: 'Error',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
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
    
    if (!email || !password) {
      toast({
        title: 'Error',
        description: 'Please enter both email and password',
        variant: 'destructive',
      });
      return;
    }

    if (isSignUp) {
      if (!clinicName.trim() || !ownerName.trim() || !ownerPhone.trim()) {
        toast({
          title: 'Error',
          description: 'Please enter clinic name, owner name, and owner phone',
          variant: 'destructive',
        });
        return;
      }
    }

    if (password.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

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
          toast({
            title: 'Sign up failed',
            description: error.message,
            variant: 'destructive',
          });
          return;
        }

        const authUserId = data.user?.id || null;

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
          toast({
            title: 'Account created, but request failed',
            description: reqError.message,
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
        toast({
          title: 'Welcome back!',
          description: 'You have successfully logged in',
        });
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
              <Stethoscope className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">DentalCare</h1>
              <p className="text-sm text-white/70">Clinic Management System</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-6">
          <h2 className="text-4xl font-display font-bold text-white leading-tight">
            Streamline Your<br />Dental Practice
          </h2>
          <p className="text-lg text-white/80 max-w-md">
            Manage patients, appointments, invoices, and inventory all in one place. 
            Built for dental clinics in Pakistan.
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
          © 2024 DentalCare. All rights reserved.
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Stethoscope className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">DentalCare</h1>
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
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
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
              <form key={formKey} onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="clinicName" className="form-label">
                        Clinic name
                      </label>
                      <Input
                        id="clinicName"
                        placeholder="e.g. Smile Dental Clinic"
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
                        disabled={isLoading}
                      />
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
                          onChange={(e) => setClinicCity(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="clinicPhone" className="form-label">
                          Clinic phone
                        </label>
                        <Input
                          id="clinicPhone"
                          placeholder="e.g. 03xx-xxxxxxx"
                          value={clinicPhone}
                          onChange={(e) => setClinicPhone(e.target.value)}
                          disabled={isLoading}
                        />
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
                        onChange={(e) => setClinicAddress(e.target.value)}
                        disabled={isLoading}
                      />
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
                          onChange={(e) => setOwnerName(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="ownerPhone" className="form-label">
                          Owner phone
                        </label>
                        <Input
                          id="ownerPhone"
                          placeholder="e.g. 03xx-xxxxxxx"
                          value={ownerPhone}
                          onChange={(e) => setOwnerPhone(e.target.value)}
                          disabled={isLoading}
                        />
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
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
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
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

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
                    setClinicName('');
                    setClinicCity('');
                    setClinicAddress('');
                    setClinicPhone('');
                    setOwnerName('');
                    setOwnerPhone('');
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
