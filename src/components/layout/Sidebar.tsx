import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Stethoscope,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks';
import type { AppRole } from '@/contexts/TenantContext';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  allowedRoles?: AppRole[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Patients', href: '/patients', icon: Users },
  { name: 'Invoices', href: '/invoices', icon: FileText, allowedRoles: ['admin', 'receptionist'] },
  { name: 'Inventory', href: '/inventory', icon: Package, allowedRoles: ['admin'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, allowedRoles: ['admin', 'dentist'] },
];

interface SidebarProps {
  onLogout: () => void;
  user?: { first_name: string; last_name: string; role: string } | null;
}

export function Sidebar({ onLogout, user }: SidebarProps) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { role, isSuperAdmin, canAccessSettings, isLoading: isRoleLoading } = useUserRole();
  const { activeClinic } = useTenant();

  if (isSuperAdmin) {
    return null;
  }

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter((item) => {
    if (!item.allowedRoles) return true;
    if (!role) return false;
    // For role-gated clinic items, treat super_admin like admin.
    if (role === 'super_admin') return item.allowedRoles.includes('admin');
    return item.allowedRoles.includes(role);
  });

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-background"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out",
        "lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Stethoscope className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-display font-semibold leading-tight tracking-tight text-sidebar-foreground">
                {activeClinic?.name || 'Clinic Companion'}
              </h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
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
          </nav>

          {/* User Section */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground font-medium">
                {user?.first_name?.[0] || 'A'}{user?.last_name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {user?.first_name || 'Admin'} {user?.last_name}
                </p>
                <p className="text-xs text-sidebar-muted capitalize">
                  {role || user?.role || 'User'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {canAccessSettings && (
                <Link
                  to="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
              )}
              <button
                onClick={() => {
                  onLogout();
                  setIsMobileMenuOpen(false);
                }}
                className={cn(
                  "flex items-center justify-center px-3 py-2 text-sm text-sidebar-muted hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors",
                  !canAccessSettings && "flex-1 gap-2"
                )}
              >
                <LogOut className="h-4 w-4" />
                {!canAccessSettings && <span className="hidden sm:inline">Logout</span>}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
