import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Stethoscope,
  X,
  Menu,
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
  const [isOpen, setIsOpen] = useState(false);

  const { role, isSuperAdmin, canAccessSettings } = useUserRole();
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

  const openSidebar = () => {
    setIsOpen(true);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    document.body.classList.add('scroll-locked');
  };

  const closeSidebar = () => {
    setIsOpen(false);
    // Unlock body scroll
    document.body.style.overflow = '';
    document.body.classList.remove('scroll-locked');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('scroll-locked');
    };
  }, []);

  return (
    <>
      <div className="sidebar-mobile-only fixed top-0 left-0 right-0 z-50 h-16 px-4 flex items-center justify-between bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-display font-semibold leading-tight tracking-tight text-foreground">
              {activeClinic?.name || 'Clinic Companion'}
            </h1>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={isOpen ? closeSidebar : openSidebar}
          className="bg-background/60 backdrop-blur"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Desktop Sidebar - Always Visible */}
      <aside className="sidebar-desktop-only fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
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
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
              )}
              <button
                onClick={onLogout}
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

      <div
        className={cn(
          'sidebar-mobile-only fixed inset-0 z-40',
          isOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        aria-hidden={!isOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
            isOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={isOpen ? closeSidebar : undefined}
        />

        <div
          className={cn(
            'absolute inset-x-0 inset-y-0 bg-background transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
            isOpen ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
          )}
          style={{ willChange: 'transform, opacity' }}
        >
          <nav className="px-4 pt-20 pb-6 space-y-2">
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={closeSidebar}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-foreground font-medium">
                {user?.first_name?.[0] || 'A'}{user?.last_name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.first_name || 'Admin'} {user?.last_name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {role || user?.role || 'User'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {canAccessSettings && (
                <Link
                  to="/settings"
                  onClick={closeSidebar}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              )}
              <button
                onClick={() => {
                  onLogout();
                  closeSidebar();
                }}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .sidebar-desktop-only { display: none; }
        }
        @media (min-width: 1024px) {
          .sidebar-mobile-only { display: none; }
        }
      `}</style>
    </>
  );
}
