import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SaasSidebar } from './SaasSidebar';

export function SaasLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInfo = user ? {
    first_name: user.user_metadata?.first_name || user.email?.split('@')[0] || 'User',
    last_name: user.user_metadata?.last_name || '',
    role: user.user_metadata?.role || 'super_admin',
  } : null;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SaasSidebar onLogout={handleLogout} user={userInfo} />
      <main className="pl-0 lg:pl-64">
        <div className="min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
