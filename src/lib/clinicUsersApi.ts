import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/contexts/TenantContext';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const USERS_CACHE_KEY = 'clinic_users_cache_v2';
const USERS_CACHE_MAX_AGE_MS = 5 * 60_000;

const getJwtPayload = (token: string): { iss?: string; exp?: number } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = atob(padded);
    const obj = JSON.parse(json) as { iss?: unknown; exp?: unknown };
    return {
      iss: typeof obj.iss === 'string' ? obj.iss : undefined,
      exp: typeof obj.exp === 'number' ? obj.exp : undefined,
    };
  } catch {
    return null;
  }
};

type ClinicUser = {
  user_id: string;
  role: AppRole;
  created_at: string | null;
  email: string | null;
  first_name: unknown;
  last_name: unknown;
};

type ListResponse = {
  clinicId: string;
  users: ClinicUser[];
};

type UsersCachePayload = {
  ts: number;
  clinicId: string;
  users: ClinicUser[];
};

type CreatePayload = {
  email: string;
  password: string;
  role: Exclude<AppRole, 'super_admin'>;
};

type UpdateRolePayload = {
  userId: string;
  role: Exclude<AppRole, 'super_admin'>;
};

type RemovePayload = {
  userId: string;
};

const invoke = async <T>(body: unknown): Promise<T> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  let {
    data: { session },
  } = await supabase.auth.getSession();

  let token = session?.access_token;
  if (!token) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) {
      throw new Error('Not authenticated');
    }
    session = refreshed.data.session ?? session;
    token = session?.access_token;
    if (!token) {
      throw new Error('Not authenticated');
    }
  }

  const payloadBeforeRefresh = getJwtPayload(token);
  const iss = payloadBeforeRefresh?.iss;
  const exp = payloadBeforeRefresh?.exp;

  if (!iss || !exp) {
    await supabase.auth.signOut();
    throw new Error('Invalid session token. Please sign out and sign in again.');
  }

  const normalizedUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
  if (!iss.startsWith(`${normalizedUrl}/auth/v1`)) {
    await supabase.auth.signOut();
    throw new Error(
      'Your login session belongs to a different Supabase project than the one configured in this app. Sign out, clear this site\'s storage, then sign in again.'
    );
  }

  // Since we're calling Edge Functions via fetch, we must handle token refresh ourselves.
  // If access token is expired/near expiry, refresh it before calling the gateway.
  const tokenExpiresAtMs = exp * 1000;
  if (tokenExpiresAtMs <= Date.now() + 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error) {
      await supabase.auth.signOut();
      throw new Error('Your session expired. Please sign in again.');
    }
    session = refreshed.data.session ?? session;
    token = session?.access_token;
    if (!token) {
      await supabase.auth.signOut();
      throw new Error('Your session expired. Please sign in again.');
    }
  }

  const doFetch = (accessToken: string) => {
    return fetch(`${normalizedUrl}/functions/v1/clinic-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  };

  let res = await doFetch(token);

  const readJson = async (r: Response) => {
    try {
      return (await r.json()) as unknown;
    } catch {
      return null;
    }
  };

  let parsed: unknown = await readJson(res);

  // If the gateway says the JWT is invalid, force-refresh and retry once.
  if (res.status === 401) {
    const obj = parsed && typeof parsed === 'object' ? (parsed as any) : null;
    const msg = obj && typeof obj.message === 'string' ? obj.message : null;
    if (msg && msg.toLowerCase().includes('invalid jwt')) {
      const refreshed = await supabase.auth.refreshSession();
      const next = refreshed.data.session?.access_token;
      if (next) {
        res = await doFetch(next);
        parsed = await readJson(res);
      }
    }
  }

  if (!res.ok) {
    const obj = parsed && typeof parsed === 'object' ? (parsed as any) : null;
    const msg =
      obj && typeof obj.error === 'string'
        ? obj.error
        : obj && typeof obj.message === 'string'
          ? obj.message
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return parsed as T;
};

const readUsersCache = (): UsersCachePayload | null => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(USERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as any;
    if (typeof obj.ts !== 'number') return null;
    if (!Array.isArray(obj.users)) return null;
    return {
      ts: obj.ts,
      clinicId: typeof obj.clinicId === 'string' ? obj.clinicId : '',
      users: obj.users as ClinicUser[],
    };
  } catch {
    return null;
  }
};

const writeUsersCache = (payload: { clinicId: string; users: ClinicUser[] }) => {
  try {
    if (typeof window === 'undefined') return;
    const next: UsersCachePayload = {
      ts: Date.now(),
      clinicId: payload.clinicId,
      users: payload.users,
    };
    window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
};

export const clinicUsersApi = {
  getCachedList: (opts?: { maxAgeMs?: number }) => {
    const cached = readUsersCache();
    if (!cached) return null;
    const maxAgeMs = opts?.maxAgeMs ?? USERS_CACHE_MAX_AGE_MS;
    if (Date.now() - cached.ts > maxAgeMs) return null;
    return cached;
  },
  list: async (): Promise<ListResponse> => {
    const res = await invoke<ListResponse>({ action: 'list' });
    writeUsersCache({ clinicId: res.clinicId, users: res.users || [] });
    return res;
  },
  prefetchList: async (): Promise<void> => {
    try {
      await clinicUsersApi.list();
    } catch {
      return;
    }
  },
  create: async (payload: CreatePayload) => {
    return invoke<{ user_id: string; role: AppRole; clinic_id: string | null }>({ action: 'create', payload });
  },
  updateRole: async (payload: UpdateRolePayload) => {
    return invoke<{ user_id: string; role: AppRole; clinic_id: string | null }>({ action: 'updateRole', payload });
  },
  remove: async (payload: RemovePayload) => {
    return invoke<{ ok: true }>({ action: 'remove', payload });
  },
};
