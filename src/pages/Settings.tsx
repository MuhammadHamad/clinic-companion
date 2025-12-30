import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Building, User, Bell, Shield, Palette } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: 'Settings Saved',
      description: 'Your settings have been updated successfully',
    });
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
                <CardDescription>Basic information about your dental clinic</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Clinic Name</label>
                    <Input defaultValue="DentalCare Clinic" />
                  </div>
                  <div>
                    <label className="form-label">Phone Number</label>
                    <Input defaultValue="042-1234567" />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <Input type="email" defaultValue="info@dentalcare.pk" />
                  </div>
                  <div>
                    <label className="form-label">Website</label>
                    <Input defaultValue="www.dentalcare.pk" />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Address</label>
                    <Textarea defaultValue="123 Main Boulevard, Gulberg III, Lahore, Pakistan" rows={2} />
                  </div>
                </div>
              </CardContent>
            </Card>

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
                    <Textarea defaultValue="Payment due within 14 days. Cash, Card, and Bank Transfer accepted." rows={2} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave}>Save Changes</Button>
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
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </div>
                  <div>
                    <Button variant="outline">Change Photo</Button>
                    <p className="text-sm text-muted-foreground mt-1">JPG or PNG. Max 2MB.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">First Name</label>
                    <Input defaultValue={user?.first_name || ''} />
                  </div>
                  <div>
                    <label className="form-label">Last Name</label>
                    <Input defaultValue={user?.last_name || ''} />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <Input type="email" defaultValue={user?.email || ''} />
                  </div>
                  <div>
                    <label className="form-label">Phone</label>
                    <Input defaultValue={user?.phone || ''} />
                  </div>
                </div>
              </CardContent>
            </Card>

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

            <div className="flex justify-end">
              <Button onClick={handleSave}>Save Changes</Button>
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
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
