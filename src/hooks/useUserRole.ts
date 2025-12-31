import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'dentist' | 'receptionist';

interface UseUserRoleReturn {
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  isDentist: boolean;
  isReceptionist: boolean;
  hasRole: (requiredRole: AppRole) => boolean;
  canAccessSettings: boolean;
  canManagePatients: boolean;
  canManageAppointments: boolean;
  canManageInvoices: boolean;
  canViewReports: boolean;
}

export function useUserRole(): UseUserRoleReturn {
  const { user, isAuthenticated } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user || !isAuthenticated) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole(null);
        } else {
          setRole(data?.role as AppRole || null);
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRole();
  }, [user, isAuthenticated]);

  const isAdmin = role === 'admin';
  const isDentist = role === 'dentist';
  const isReceptionist = role === 'receptionist';

  const hasRole = (requiredRole: AppRole): boolean => {
    return role === requiredRole;
  };

  // Permission mappings based on role
  // Admin: Full access
  // Dentist: Can view patients, appointments, limited settings
  // Receptionist: Limited access, no settings
  const canAccessSettings = isAdmin;
  const canManagePatients = isAdmin || isDentist || isReceptionist;
  const canManageAppointments = isAdmin || isDentist || isReceptionist;
  const canManageInvoices = isAdmin || isReceptionist;
  const canViewReports = isAdmin || isDentist;

  return {
    role,
    isLoading,
    isAdmin,
    isDentist,
    isReceptionist,
    hasRole,
    canAccessSettings,
    canManagePatients,
    canManageAppointments,
    canManageInvoices,
    canViewReports,
  };
}
