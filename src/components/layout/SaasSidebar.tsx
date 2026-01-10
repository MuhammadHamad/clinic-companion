import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  Shield,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const navigation: NavItem[] = [
  { name: 'Overview', href: '/saas', icon: LayoutDashboard },
  { name: 'Requests', href: '/saas/requests', icon: Inbox },
  { name: 'Clinics', href: '/saas/clinics', icon: Building2 },
  { name: 'Users', href: '/saas/users', icon: Users },
];

interface SaasSidebarProps {
  onLogout: () => void;
  user?: { first_name: string; last_name: string; role: string } | null;
}

export function SaasSidebar({ onLogout, user }: SaasSidebarProps) {
  const location = useLocation();
  const { clinics, activeClinicId, setActiveClinicId, isLoading } = useTenant();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-sidebar-foreground">Clinic Companion</h1>
            <p className="text-xs text-sidebar-muted">Super Admin</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/saas' && location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'sidebar-item',
                  isActive && 'sidebar-item-active'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          <div className="mt-4 px-1">
            <p className="text-xs text-sidebar-muted mb-2">Active Clinic</p>
            <Select
              value={activeClinicId || ''}
              onValueChange={(val) => setActiveClinicId(val || null)}
              disabled={isLoading || clinics.length === 0}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder={isLoading ? 'Loading…' : clinics.length ? 'Select clinic' : 'No clinics'} />
              </SelectTrigger>
              <SelectContent>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground font-medium">
              {user?.first_name?.[0] || 'S'}{user?.last_name?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.first_name || 'Super'} {user?.last_name || 'Admin'}
              </p>
              <p className="text-xs text-sidebar-muted capitalize">
                {user?.role || 'super_admin'}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-sidebar-muted hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors'
            )}
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
