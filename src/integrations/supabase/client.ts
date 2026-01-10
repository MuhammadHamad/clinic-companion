import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

console.debug('[Supabase] VITE_SUPABASE_URL', supabaseUrl);

const getProjectRef = (url: string): string | null => {
  try {
    const host = new URL(url).hostname;
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
};

const projectRef = typeof supabaseUrl === 'string' ? getProjectRef(supabaseUrl) : null;

const CLOSE_MARK_KEY = '__cc_tab_closed_v1';

const clearLegacyLocalStorageAuth = () => {
  if (!projectRef) return;
  try {
    localStorage.removeItem(`sb-${projectRef}-auth-token`);
    localStorage.removeItem('supabase.auth.token');
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(`sb-${projectRef}-`) && k.includes('auth-token')) {
        localStorage.removeItem(k);
        i -= 1;
      }
    }
  } catch {
    // ignore
  }
};

const clearSessionStorageAuth = () => {
  try {
    sessionStorage.removeItem('supabase.auth.token');
    if (projectRef) {
      sessionStorage.removeItem(`sb-${projectRef}-auth-token`);
    }
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (k.startsWith('sb-') && k.includes('auth-token')) {
        sessionStorage.removeItem(k);
        i -= 1;
      }
    }
  } catch {
    // ignore
  }
};

clearLegacyLocalStorageAuth();

try {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const navType = nav?.type || 'navigate';
  const isReload = navType === 'reload';

  const hadCloseMark = !!localStorage.getItem(CLOSE_MARK_KEY);

  // Reload sets unload events too; don't treat it as a close.
  if (isReload) {
    localStorage.removeItem(CLOSE_MARK_KEY);
  } else if (hadCloseMark) {
    clearSessionStorageAuth();
    localStorage.removeItem(CLOSE_MARK_KEY);
  }

  const markClosed = () => {
    try {
      localStorage.setItem(CLOSE_MARK_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  window.addEventListener('pagehide', markClosed);
  window.addEventListener('beforeunload', markClosed);
} catch {
  // ignore
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: sessionStorage,
  },
});
