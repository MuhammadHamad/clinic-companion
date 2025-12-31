import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

export function MainLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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
