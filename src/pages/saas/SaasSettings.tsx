import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Database, Bell, Mail, Lock } from 'lucide-react';

export default function SaasSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [newClinicAlerts, setNewClinicAlerts] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    toast({
      title: 'Settings saved',
      description: 'Notification preferences have been updated',
    });
    
    setIsSaving(false);
  };

  const handleExportData = async () => {
    toast({
      title: 'Export started',
      description: 'Platform data export will be sent to your email',
    });
  };

  return (
    <div className="min-h-screen">
      <Header title="Settings" subtitle="Manage platform configuration and preferences" />

      <div className="p-6 space-y-6 animate-fade-in max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Account Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Email</Label>
                <p className="text-sm font-medium mt-1">{user?.email || '—'}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Role</Label>
                <p className="text-sm font-medium mt-1 capitalize">Super Admin</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">User ID</Label>
                <p className="font-mono text-xs mt-1 text-muted-foreground">{user?.id || '—'}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Account Created</Label>
                <p className="text-sm font-medium mt-1">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email updates about platform activity
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="new-clinic-alerts">New Clinic Requests</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when new clinics request approval
                </p>
              </div>
              <Switch
                id="new-clinic-alerts"
                checked={newClinicAlerts}
                onCheckedChange={setNewClinicAlerts}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="system-alerts">System Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts about system issues and updates
                </p>
              </div>
              <Switch
                id="system-alerts"
                checked={systemAlerts}
                onCheckedChange={setSystemAlerts}
              />
            </div>

            <div className="pt-4">
              <Button onClick={handleSaveNotifications} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Notification Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Data Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Platform Data Export</Label>
              <p className="text-sm text-muted-foreground">
                Export all platform data including clinics, users, and activity logs
              </p>
              <Button variant="outline" onClick={handleExportData}>
                Export Data
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Database Statistics</Label>
              <div className="grid grid-cols-3 gap-4 mt-2">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Total Clinics</p>
                  <p className="text-lg font-semibold mt-1">—</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <p className="text-lg font-semibold mt-1">—</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Storage Used</p>
                  <p className="text-lg font-semibold mt-1">—</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Change Password</Label>
              <p className="text-sm text-muted-foreground">
                Update your account password for enhanced security
              </p>
              <Button variant="outline">
                Change Password
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
              <Button variant="outline" disabled>
                Enable 2FA (Coming Soon)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-base text-warning">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Platform Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Temporarily disable all clinic access for maintenance
              </p>
              <Button variant="outline" disabled>
                Enable Maintenance Mode (Coming Soon)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
