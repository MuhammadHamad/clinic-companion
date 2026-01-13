import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'dentist' | 'receptionist' | 'super_admin';

type ClinicRow = {
  id: string;
  name: string;
  slug?: string | null;
};

type TenantContextValue = {
  role: AppRole | null;
  clinicId: string | null;
  activeClinicId: string | null;
  activeClinic: ClinicRow | null;
  clinics: ClinicRow[];
  isLoading: boolean;
  hasLoadedRole: boolean;
  error: string | null;
  setActiveClinicId: (clinicId: string | null) => void;
  setActiveClinicName: (name: string) => void;
  refresh: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const ACTIVE_CLINIC_STORAGE_KEY = 'active_clinic_id';
const CLINIC_NAME_CACHE_STORAGE_KEY = 'clinic_name_cache_v1';

function readClinicNameCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLINIC_NAME_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeClinicNameCache(next: Record<string, string>) {
  try {
    localStorage.setItem(CLINIC_NAME_CACHE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [role, setRole] = useState<AppRole | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(null);
  const [activeClinic, setActiveClinic] = useState<ClinicRow | null>(null);
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedRole, setHasLoadedRole] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyCachedClinicName = useCallback((id: string | null) => {
    if (!id) return;
    const cache = readClinicNameCache();
    const cachedName = cache[id];
    if (!cachedName) return;
    setActiveClinic((prev) => {
      if (prev?.id === id && prev?.name === cachedName) return prev;
      return {
        id,
        name: cachedName,
        slug: prev?.id === id ? prev?.slug ?? null : null,
      };
    });
  }, []);

  const setActiveClinicName = useCallback(
    (name: string) => {
      const nextName = String(name || '').trim();
      if (!nextName) return;

      setActiveClinic((prev) => {
        const id = activeClinicId || prev?.id;
        if (!id) return prev;

        const cache = readClinicNameCache();
        writeClinicNameCache({
          ...cache,
          [id]: nextName,
        });

        return {
          id,
          name: nextName,
          slug: prev?.slug ?? null,
        };
      });

      setClinics((prev) => prev.map((c) => (c.id === activeClinicId ? { ...c, name: nextName } : c)));
    },
    [activeClinicId],
  );

  const setActiveClinicId = useCallback(
    (nextClinicId: string | null) => {
      if (role !== 'super_admin') return;
      setActiveClinicIdState(nextClinicId);
      if (nextClinicId) {
        localStorage.setItem(ACTIVE_CLINIC_STORAGE_KEY, nextClinicId);
      } else {
        localStorage.removeItem(ACTIVE_CLINIC_STORAGE_KEY);
      }

      if (nextClinicId) {
        applyCachedClinicName(nextClinicId);
      } else {
        setActiveClinic(null);
      }
    },
    [applyCachedClinicName, role],
  );

  const loadRoleAndClinic = useCallback(async (): Promise<string | null> => {
    if (!user || !isAuthenticated) {
      setRole(null);
      setClinicId(null);
      setActiveClinicIdState(null);
      setActiveClinic(null);
      setClinics([]);
      setIsLoading(false);
      setHasLoadedRole(false);
      setError(null);
      return null;
    }

    setIsLoading(true);
    setHasLoadedRole(false);
    setError(null);

    try {
      const url = (supabase as unknown as { supabaseUrl?: string }).supabaseUrl;
      if (url) {
        logger.debug('[Tenant] supabaseUrl', url);
      }
    } catch {
      // ignore
    }

    logger.debug('[Tenant] loadRoleAndClinic user', user.id);

    const { data, error } = await supabase
      .from('user_roles')
      .select('role, clinic_id')
      .eq('user_id', user.id)
      .single();

    if (error) {
      logger.error('[Tenant] user_roles query error', error);
      setError(error.message || 'Failed to load user role');
      setRole(null);
      setClinicId(null);
      setActiveClinicIdState(null);
      setActiveClinic(null);
      setClinics([]);
      setIsLoading(false);
      setHasLoadedRole(true);
      return null;
    }

    const row = (data || null) as { role: AppRole; clinic_id: string | null } | null;
    logger.debug('[Tenant] user_roles row', row);

    const nextRole = row?.role || null;
    const nextClinicId = row?.clinic_id || null;

    setRole(nextRole);
    setClinicId(nextClinicId);

    let resolvedActiveClinicId: string | null = null;

    if (nextRole === 'super_admin') {
      const stored = localStorage.getItem(ACTIVE_CLINIC_STORAGE_KEY);
      const initial = stored || nextClinicId;
      resolvedActiveClinicId = initial || null;
      setActiveClinicIdState(resolvedActiveClinicId);
    } else {
      resolvedActiveClinicId = nextClinicId;
      setActiveClinicIdState(resolvedActiveClinicId);
    }

    applyCachedClinicName(resolvedActiveClinicId);

    setIsLoading(false);
    setHasLoadedRole(true);

    return resolvedActiveClinicId;
  }, [applyCachedClinicName, user, isAuthenticated]);

  const loadClinicsListIfSuperAdmin = useCallback(async () => {
    if (role !== 'super_admin') {
      setClinics([]);
      return;
    }

    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, slug')
      .order('created_at', { ascending: false });

    if (error) {
      setClinics([]);
      return;
    }

    setClinics((data || []) as ClinicRow[]);
  }, [role]);

  const loadActiveClinic = useCallback(async (clinicId?: string | null) => {
    const id = clinicId ?? activeClinicId;
    if (!id) {
      setActiveClinic(null);
      return;
    }

    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, slug')
      .eq('id', id)
      .single();

    if (error) {
      if ((error as unknown as { code?: string }).code === 'PGRST116') {
        setActiveClinicIdState(null);
        setActiveClinic(null);
        try {
          localStorage.removeItem(ACTIVE_CLINIC_STORAGE_KEY);
        } catch {
          // ignore
        }
      }
      // If RLS blocks reading clinics but updates are allowed, we still want to
      // keep the last known clinic name (optimistic UI) instead of reverting.
      return;
    }

    const nextClinic = (data as ClinicRow) || null;
    setActiveClinic(nextClinic);
    if (nextClinic?.id && nextClinic?.name) {
      const cache = readClinicNameCache();
      writeClinicNameCache({
        ...cache,
        [nextClinic.id]: nextClinic.name,
      });
    }
  }, [activeClinicId]);

  const refresh = useCallback(async () => {
    const resolvedActiveClinicId = await loadRoleAndClinic();
    await loadClinicsListIfSuperAdmin();
    await loadActiveClinic(resolvedActiveClinicId);
  }, [loadActiveClinic, loadClinicsListIfSuperAdmin, loadRoleAndClinic]);

  useEffect(() => {
    loadRoleAndClinic();
  }, [loadRoleAndClinic]);

  useEffect(() => {
    loadClinicsListIfSuperAdmin();
  }, [loadClinicsListIfSuperAdmin]);

  useEffect(() => {
    loadActiveClinic();
  }, [loadActiveClinic]);

  const value = useMemo<TenantContextValue>(
    () => ({
      role,
      clinicId,
      activeClinicId,
      activeClinic,
      clinics,
      isLoading,
      hasLoadedRole,
      error,
      setActiveClinicId,
      setActiveClinicName,
      refresh,
    }),
    [
      role,
      clinicId,
      activeClinicId,
      activeClinic,
      clinics,
      isLoading,
      hasLoadedRole,
      error,
      setActiveClinicId,
      setActiveClinicName,
      refresh,
    ],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
}
