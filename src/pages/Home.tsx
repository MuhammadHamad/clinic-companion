import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import Dashboard from './Dashboard';

export default function Home() {
  const { isLoading, isSuperAdmin } = useUserRole();

  if (isLoading) {
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

  return <Dashboard />;
}
