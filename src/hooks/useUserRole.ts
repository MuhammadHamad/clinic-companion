import { useCallback } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import type { AppRole } from '@/contexts/TenantContext';

export type { AppRole };

interface UseUserRoleReturn {
  role: AppRole | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
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
  const { role, isLoading } = useTenant();

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin' || isSuperAdmin;
  const isDentist = role === 'dentist';
  const isReceptionist = role === 'receptionist';

  const hasRole = useCallback(
    (requiredRole: AppRole): boolean => {
      return role === requiredRole;
    },
    [role],
  );

  // Permission mappings based on role
  // Admin: Full access
  // Dentist: Can view patients, appointments, limited settings
  // Receptionist: Limited access, no settings
  const canAccessSettings = isAdmin || isSuperAdmin;
  const canManagePatients = isSuperAdmin || isAdmin || isDentist || isReceptionist;
  const canManageAppointments = isSuperAdmin || isAdmin || isDentist || isReceptionist;
  const canManageInvoices = isSuperAdmin || isAdmin || isReceptionist;
  const canViewReports = isSuperAdmin || isAdmin || isDentist;

  return {
    role,
    isLoading,
    isSuperAdmin,
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
