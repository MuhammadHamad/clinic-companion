import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  Shield,
  Inbox,
  Settings,
  Menu,
  X,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => document.documentElement.classList.contains('dark'));

  const openSidebar = () => {
    setIsOpen(true);
    document.body.style.overflow = 'hidden';
    document.body.classList.add('scroll-locked');
  };

  const closeSidebar = () => {
    setIsOpen(false);
    document.body.style.overflow = '';
    document.body.classList.remove('scroll-locked');
  };

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('scroll-locked');
    };
  }, []);

  const setDarkMode = (enabled: boolean) => {
    setIsDarkMode(enabled);
    document.documentElement.classList.toggle('dark', enabled);
    localStorage.setItem('color-mode', enabled ? 'dark' : 'light');
  };

  const ThemeToggle3D = ({ className }: { className?: string }) => {
    return (
      <button
        type="button"
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={isDarkMode}
        onClick={() => setDarkMode(!isDarkMode)}
        className={cn('theme-toggle-3d', isDarkMode && 'is-dark', className)}
      >
        <span className="theme-toggle-3d__surface" aria-hidden="true">
          <span className="theme-toggle-3d__icon" aria-hidden="true">
            {isDarkMode ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </span>
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="sidebar-mobile-only fixed top-0 left-0 right-0 z-50 h-16 px-4 flex items-center justify-between bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <h1
              className="truncate text-sm sm:text-base font-display font-semibold leading-tight tracking-tight text-foreground"
              title="Endicode Clinic"
            >
              Endicode Clinic
            </h1>
            <p className="truncate text-xs text-muted-foreground">Super Admin</p>
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

      <aside className="sidebar-desktop-only fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-sidebar-foreground">Endicode Clinic</h1>
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

          <div className="mb-3 flex items-center justify-center">
            <ThemeToggle3D />
          </div>

          <div className="flex gap-2">
            <Link
              to="/saas/settings"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            <button
              onClick={onLogout}
              className={cn(
                'flex items-center justify-center px-3 py-2 text-sm text-sidebar-muted hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors'
              )}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>

      <div
        className={cn('sidebar-mobile-only fixed inset-0 z-40', isOpen ? 'pointer-events-auto' : 'pointer-events-none')}
        aria-hidden={!isOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
            isOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={isOpen ? closeSidebar : undefined}
        />

        <div
          className={cn(
            'absolute inset-x-0 inset-y-0 bg-background transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
            isOpen ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0',
          )}
          style={{ willChange: 'transform, opacity' }}
        >
          <div className="flex h-full flex-col pt-20">
            <nav className="px-4 space-y-2">
              {navigation.map((item) => {
                const isActive =
                  location.pathname === item.href || (item.href !== '/saas' && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={closeSidebar}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto p-4 pt-6">
              <div className="rounded-xl border border-border bg-card/40 backdrop-blur-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-foreground font-medium">
                    {user?.first_name?.[0] || 'S'}{user?.last_name?.[0] || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user?.first_name || 'Super'} {user?.last_name || 'Admin'}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role || 'super_admin'}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center">
                  <ThemeToggle3D />
                </div>

                <div className="mt-4 space-y-2">
                  <Link
                    to="/saas/settings"
                    onClick={closeSidebar}
                    className="flex items-center gap-3 w-full px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                  <button
                    onClick={() => {
                      onLogout();
                      closeSidebar();
                    }}
                    className="flex items-center gap-3 w-full px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
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
