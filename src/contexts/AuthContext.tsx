import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthReady: boolean;
  /** True while a session refresh is in-flight (e.g. after app resume). UI should not redirect during this window. */
  isAuthRecovering: boolean;
  /** Force-refresh the session (e.g. on app resume). Returns the refreshed session. */
  refreshSession: () => Promise<Session | null>;
  /** Increments after initial restore and after every successful resume refresh. Use as a React key to force remount. */
  authVersion: number;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthReady: false,
  isAuthRecovering: false,
  refreshSession: async () => null,
  authVersion: 0,
});

export const useAuth = () => useContext(AuthContext);

// ─── Native session persistence helpers ───
// On Capacitor/native, mirror the Supabase session into @capacitor/preferences
// so it survives full app kills (WebView localStorage can be wiped by iOS).

async function saveSessionToNative(session: Session | null) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() === 'web') return;
    const { Preferences } = await import('@capacitor/preferences');
    if (session) {
      await Preferences.set({ key: 'supabase_session', value: JSON.stringify(session) });
    } else {
      await Preferences.remove({ key: 'supabase_session' });
    }
  } catch {
    // Not on native or Preferences not available — fine
  }
}

async function loadSessionFromNative(): Promise<Session | null> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.getPlatform() === 'web') return null;
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: 'supabase_session' });
    if (value) return JSON.parse(value) as Session;
  } catch {
    // Not on native or Preferences not available
  }
  return null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthRecovering, setIsAuthRecovering] = useState(false);
  const initialized = useRef(false);

  // Single-flight guard for refreshSession
  const refreshPromise = useRef<Promise<Session | null> | null>(null);

  const refreshSession = useCallback(async (): Promise<Session | null> => {
    // Deduplicate concurrent calls (e.g. multiple resume events firing)
    if (refreshPromise.current) return refreshPromise.current;

    const doRefresh = async (): Promise<Session | null> => {
      setIsAuthRecovering(true);
      try {
        const { data: { session: s }, error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn('[Auth] refreshSession failed, falling back to cached:', error.message);
          const { data: { session: cached } } = await supabase.auth.getSession();
          setSession(cached);
          setUser(cached?.user ?? null);
          // Try native backup if web storage failed
          if (!cached) {
            const native = await loadSessionFromNative();
            if (native) {
              console.log('[Auth] Restoring session from native storage');
              const { data: { session: restored }, error: setErr } = await supabase.auth.setSession({
                access_token: native.access_token,
                refresh_token: native.refresh_token,
              });
              if (!setErr && restored) {
                setSession(restored);
                setUser(restored.user);
                return restored;
              }
            }
          }
          return cached;
        }
        setSession(s);
        setUser(s?.user ?? null);
        if (s) saveSessionToNative(s);
        return s;
      } catch {
        return null;
      } finally {
        setIsAuthRecovering(false);
        refreshPromise.current = null;
      }
    };

    refreshPromise.current = doRefresh();
    return refreshPromise.current;
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // 1. Set up the listener FIRST (per Supabase docs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        console.log('[Auth] onAuthStateChange:', _event, newSession ? 'has session' : 'no session');
        setSession(newSession);
        setUser(newSession?.user ?? null);
        // Mirror to native on every change (fire-and-forget)
        saveSessionToNative(newSession);
      }
    );

    // 2. Restore session — try web first, then native backup
    const restore = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          console.log('[Auth] Restored from web storage');
          setSession(existingSession);
          setUser(existingSession.user);
          saveSessionToNative(existingSession);
          setIsAuthReady(true);
          return;
        }

        // No web session — try native backup (cold start after iOS killed WebView)
        const nativeSession = await loadSessionFromNative();
        if (nativeSession) {
          console.log('[Auth] No web session, restoring from native storage');
          try {
            const { data: { session: restored }, error } = await supabase.auth.setSession({
              access_token: nativeSession.access_token,
              refresh_token: nativeSession.refresh_token,
            });
            if (!error && restored) {
              console.log('[Auth] Restored from native storage successfully');
              setSession(restored);
              setUser(restored.user);
            } else {
              console.warn('[Auth] Native session restore failed:', error?.message);
              // Clear corrupted native session
              saveSessionToNative(null);
            }
          } catch (setErr) {
            console.error('[Auth] Native setSession threw:', setErr);
            saveSessionToNative(null);
          }
        } else {
          console.log('[Auth] No session found (web or native)');
        }
      } catch (err) {
        console.error('[Auth] Session restore error:', err);
      } finally {
        setIsAuthReady(true);
      }
    };

    restore();

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isAuthReady, isAuthRecovering, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};
