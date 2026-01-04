import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks';

export function MainLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isSuperAdmin, isLoading: isRoleLoading } = useUserRole();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Extract user info from Supabase user metadata
  const userInfo = user ? {
    first_name: user.user_metadata?.first_name || user.email?.split('@')[0] || 'User',
    last_name: user.user_metadata?.last_name || '',
    role: user.user_metadata?.role || 'user',
  } : null;

  if (isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isSuperAdmin) {
    return <Navigate to="/saas" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        onLogout={handleLogout} 
        user={userInfo} 
      />
      <main className="pl-64">
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
