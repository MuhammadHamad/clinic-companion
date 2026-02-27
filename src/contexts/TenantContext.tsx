import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'dentist' | 'receptionist' | 'super_admin';

type ClinicRow = {
  id: string;
  name: string;
  slug?: string | null;
  is_paused?: boolean | null;
  paused_at?: string | null;
  pause_reason?: string | null;
  admin_email?: string | null;
};

type TenantContextValue = {
  role: AppRole | null;
  clinicId: string | null;
  activeClinicId: string | null;
  activeClinic: ClinicRow | null;
  isClinicPaused: boolean;
  clinicPausedAt: string | null;
  clinicPauseReason: string | null;
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

  const hasEverLoadedRoleRef = useRef(false);

  const [role, setRole] = useState<AppRole | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(null);
  const [activeClinic, setActiveClinic] = useState<ClinicRow | null>(null);
  const [isClinicPaused, setIsClinicPaused] = useState(false);
  const [clinicPausedAt, setClinicPausedAt] = useState<string | null>(null);
  const [clinicPauseReason, setClinicPauseReason] = useState<string | null>(null);
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
      setIsClinicPaused(false);
      setClinicPausedAt(null);
      setClinicPauseReason(null);
      setClinics([]);
      setIsLoading(false);
      setHasLoadedRole(false);
      hasEverLoadedRoleRef.current = false;
      setError(null);
      return null;
    }

    const isInitialLoad = !hasEverLoadedRoleRef.current;
    if (isInitialLoad) {
      setIsLoading(true);
      setHasLoadedRole(false);
    }
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
      .select('role, clinic_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('[Tenant] user_roles query error', error);
      setError(error.message || 'Failed to load user role');
      setRole(null);
      setClinicId(null);
      setActiveClinicIdState(null);
      setActiveClinic(null);
      setIsClinicPaused(false);
      setClinicPausedAt(null);
      setClinicPauseReason(null);
      setClinics([]);
      setIsLoading(false);
      setHasLoadedRole(true);
      return null;
    }

    const row = ((data || []) as Array<{ role: AppRole; clinic_id: string | null }>)[0] || null;
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
    hasEverLoadedRoleRef.current = true;

    return resolvedActiveClinicId;
  }, [applyCachedClinicName, user, isAuthenticated]);

  const loadClinicsListIfSuperAdmin = useCallback(async () => {
    if (role !== 'super_admin') {
      setClinics([]);
      return;
    }

    const withPauseFields = await supabase
      .from('clinics')
      .select(`
        id, name, slug, is_paused, paused_at, pause_reason,
        clinic_admin_emails!inner(admin_email)
      `)
      .order('created_at', { ascending: false });

    let data: any[] | null = withPauseFields.data as any[] | null;
    let error: any = withPauseFields.error as any;

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      const withEmailTable = await supabase
        .from('clinics')
        .select(`
          id, name, slug,
          clinic_admin_emails!inner(admin_email)
        `)
        .order('created_at', { ascending: false });

      if (!withEmailTable.error) {
        data = withEmailTable.data as any[] | null;
        error = withEmailTable.error as any;
      } else {
        const legacy = await supabase
          .from('clinics')
          .select('id, name, slug')
          .order('created_at', { ascending: false });

        data = legacy.data as any[] | null;
        error = legacy.error as any;
      }
    }

    if (error) {
      setClinics([]);
      return;
    }

    setClinics(
      ((data || []) as ClinicRow[]).map((c) => ({
        ...c,
        is_paused: c.is_paused ?? false,
        paused_at: c.paused_at ?? null,
        pause_reason: c.pause_reason ?? null,
        admin_email: (c as any).clinic_admin_emails?.[0]?.admin_email ?? null,
      })),
    );
  }, [role]);

  const loadActiveClinic = useCallback(async (clinicId?: string | null) => {
    const id = clinicId ?? activeClinicId;
    if (!id) {
      setActiveClinic(null);
      setIsClinicPaused(false);
      setClinicPausedAt(null);
      setClinicPauseReason(null);
      return;
    }

    applyCachedClinicName(id);

    const withPauseFields = await supabase
      .from('clinics')
      .select(`
        id, name, slug, is_paused, paused_at, pause_reason,
        clinic_admin_emails!inner(admin_email)
      `)
      .eq('id', id)
      .single();

    let data: any = withPauseFields.data as any;
    let error: any = withPauseFields.error as any;

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      const withEmailTable = await supabase
        .from('clinics')
        .select(`
          id, name, slug,
          clinic_admin_emails!inner(admin_email)
        `)
        .eq('id', id)
        .single();

      if (!withEmailTable.error) {
        data = withEmailTable.data as any;
        error = withEmailTable.error as any;
      } else {
        const legacy = await supabase.from('clinics').select('id, name, slug').eq('id', id).single();
        data = legacy.data as any;
        error = legacy.error as any;
      }
    }

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
      applyCachedClinicName(id);
      return;
    }

    const nextClinic =
      ((data as ClinicRow) && {
        ...(data as ClinicRow),
        is_paused: (data as ClinicRow).is_paused ?? false,
        paused_at: (data as ClinicRow).paused_at ?? null,
        pause_reason: (data as ClinicRow).pause_reason ?? null,
        admin_email: (data as any).clinic_admin_emails?.[0]?.admin_email ?? null,
      }) || null;
    setActiveClinic(nextClinic);

    if (role && role !== 'super_admin') {
      const paused = Boolean(nextClinic?.is_paused);
      setIsClinicPaused(paused);
      setClinicPausedAt(nextClinic?.paused_at ? String(nextClinic.paused_at) : null);
      setClinicPauseReason(nextClinic?.pause_reason ? String(nextClinic.pause_reason) : null);
    } else {
      setIsClinicPaused(false);
      setClinicPausedAt(null);
      setClinicPauseReason(null);
    }

    if (nextClinic?.id && nextClinic?.name) {
      const cache = readClinicNameCache();
      writeClinicNameCache({
        ...cache,
        [nextClinic.id]: nextClinic.name,
      });
    }
  }, [activeClinicId, applyCachedClinicName, role]);

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
      isClinicPaused,
      clinicPausedAt,
      clinicPauseReason,
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
      isClinicPaused,
      clinicPausedAt,
      clinicPauseReason,
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
