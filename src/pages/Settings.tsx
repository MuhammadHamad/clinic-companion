import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks';
import { Building, User, Bell } from 'lucide-react';

function toClinicBaseName(storedName: string): string {
  let next = String(storedName || '').trim();
  if (!next) return '';

  next = next.replace(/\bdental\b/gi, ' ');
  next = next.replace(/['’]s\s+clinic\s*$/i, '');
  next = next.replace(/\bclinic\b\s*$/i, '');
  next = next.replace(/\s+/g, ' ').trim();
  return next;
}

function toClinicDisplayName(baseName: string): string {
  let next = String(baseName || '').trim();
  next = next.replace(/\bdental\b/gi, ' ');
  next = next.replace(/\s+/g, ' ').trim();
  if (!next) return '';
  return `${next}'s Clinic`;
}

export default function Settings() {
  const { user } = useAuth();
  const { activeClinic, activeClinicId, isLoading: isTenantLoading, refresh, setActiveClinicName } = useTenant();
  const { toast } = useToast();

  const [clinicName, setClinicName] = useState('');
  const [isClinicNameDirty, setIsClinicNameDirty] = useState(false);
  const [isSavingClinic, setIsSavingClinic] = useState(false);

  const [firstName, setFirstName] = useState(user?.user_metadata?.first_name || '');
  const [lastName, setLastName] = useState(user?.user_metadata?.last_name || '');
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const showAdvancedClinicSettings = false;
  const showAdvancedNotifications = false;
  const showChangePassword = false;

  const profileInitials = useMemo(() => {
    const a = String(firstName || user?.email?.[0] || 'U').trim()[0] || 'U';
    const b = String(lastName || '').trim()[0] || '';
    return `${a}${b}`.toUpperCase();
  }, [firstName, lastName, user?.email]);

  useEffect(() => {
    setFirstName(user?.user_metadata?.first_name || '');
    setLastName(user?.user_metadata?.last_name || '');
    setPhone(user?.user_metadata?.phone || '');
  }, [user?.id]);

  useEffect(() => {
    setClinicName(activeClinic?.name || '');
    setIsClinicNameDirty(false);
  }, [activeClinic?.id]);

  useEffect(() => {
    if (isClinicNameDirty) return;
    setClinicName(activeClinic?.name || '');
  }, [activeClinic?.name, isClinicNameDirty]);

  const handleSaveClinic = async () => {
    if (!activeClinicId) {
      toast({
        title: 'No clinic selected',
        description: 'Please select a clinic first.',
        variant: 'destructive',
      });
      return;
    }

    const displayName = String(clinicName || '').trim();
    if (!displayName) {
      toast({
        title: 'Validation error',
        description: 'Clinic name is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingClinic(true);
    try {
      const { data, error } = await supabase
        .from('clinics')
        .update({ name: displayName })
        .eq('id', activeClinicId)
        .select('id, name, slug')
        .single();

      if (error) throw error;

      // If RLS blocks UPDATE, Supabase can sometimes return no error but also no row.
      // Treat this as a hard failure so we never "pretend" it saved.
      if (!data?.id) {
        throw new Error('Clinic name could not be saved. Your account is not permitted to update this clinic.');
      }

      // Update UI immediately even if the re-fetch is blocked by RLS.
      setActiveClinicName(data.name);
      setClinicName(data.name);
      setIsClinicNameDirty(false);

      // Best-effort re-fetch to sync all tenant state.
      await refresh();

      toast({
        title: 'Clinic updated',
        description: 'Clinic name has been updated successfully.',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to update clinic',
        description: err?.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSavingClinic(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    if (!String(firstName || '').trim()) {
      toast({
        title: 'Validation error',
        description: 'First name is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: String(firstName || '').trim(),
          last_name: String(lastName || '').trim(),
          phone: String(phone || '').trim(),
        },
      });

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to update profile',
        description: err?.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Settings" subtitle="Manage your clinic and account settings" />
      
      <div className="p-6 animate-fade-in">
        <Tabs defaultValue="clinic" className="space-y-6">
          <TabsList>
            <TabsTrigger value="clinic" className="gap-2">
              <Building className="h-4 w-4" />
              Clinic
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* Clinic Settings */}
          <TabsContent value="clinic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Clinic Information</CardTitle>
                <CardDescription>Basic information for this clinic</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 max-w-xl">
                  <div>
                    <label className="form-label">Clinic Name</label>
                    <Input
                      value={clinicName}
                      onChange={(e) => {
                        setClinicName(e.target.value);
                        setIsClinicNameDirty(true);
                      }}
                      placeholder={isTenantLoading ? 'Loading…' : 'Enter clinic name'}
                      disabled={isTenantLoading || !activeClinicId}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Example: <span className="font-medium">City Medical Center</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {showAdvancedClinicSettings && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Business Hours</CardTitle>
                    <CardDescription>Set your clinic operating hours</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="form-label">Opening Time</label>
                        <Input type="time" defaultValue="09:00" />
                      </div>
                      <div>
                        <label className="form-label">Closing Time</label>
                        <Input type="time" defaultValue="18:00" />
                      </div>
                      <div>
                        <label className="form-label">Appointment Duration (min)</label>
                        <Input type="number" defaultValue="30" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">Sunday Closed</p>
                        <p className="text-sm text-muted-foreground">Close clinic on Sundays</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Settings</CardTitle>
                    <CardDescription>Configure invoice numbering and terms</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Invoice Prefix</label>
                        <Input defaultValue="INV-" />
                      </div>
                      <div>
                        <label className="form-label">Next Invoice Number</label>
                        <Input type="number" defaultValue="5" />
                      </div>
                      <div className="col-span-2">
                        <label className="form-label">Default Payment Terms</label>
                        <Input defaultValue="Payment due within 14 days. Cash, Card, and Bank Transfer accepted." />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSaveClinic} disabled={isTenantLoading || isSavingClinic || !activeClinicId}>
                {isSavingClinic ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </TabsContent>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                    {profileInitials}
                  </div>
                  <div>
                    <Button variant="outline">Change Photo</Button>
                    <p className="text-sm text-muted-foreground mt-1">JPG or PNG. Max 2MB.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 max-w-xl">
                  <div>
                    <label className="form-label">First Name</label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Last Name</label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <Input type="email" value={user?.email || ''} disabled />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {showChangePassword && (
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your account password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 max-w-md">
                    <div>
                      <label className="form-label">Current Password</label>
                      <Input type="password" />
                    </div>
                    <div>
                      <label className="form-label">New Password</label>
                      <Input type="password" />
                    </div>
                    <div>
                      <label className="form-label">Confirm New Password</label>
                      <Input type="password" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={isSavingProfile || !user}>
                {isSavingProfile ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to be notified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="font-medium">Appointment Reminders</p>
                    <p className="text-sm text-muted-foreground">Get notified about upcoming appointments</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="font-medium">Low Stock Alerts</p>
                    <p className="text-sm text-muted-foreground">Get notified when inventory is running low</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <div>
                    <p className="font-medium">Payment Received</p>
                    <p className="text-sm text-muted-foreground">Get notified when a payment is recorded</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                {showAdvancedNotifications && (
                  <>
                    <div className="flex items-center justify-between py-3 border-b border-border">
                      <div>
                        <p className="font-medium">Overdue Invoices</p>
                        <p className="text-sm text-muted-foreground">Get notified about overdue payments</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">Daily Summary</p>
                        <p className="text-sm text-muted-foreground">Receive a daily summary email</p>
                      </div>
                      <Switch />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  toast({
                    title: 'Saved',
                    description: 'Notification preferences saved locally for now.',
                  })
                }
              >
                Save Changes
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
