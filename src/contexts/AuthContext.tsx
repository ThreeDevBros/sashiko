import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthReady: boolean;
  /** Force-refresh the session (e.g. on app resume). Returns the refreshed session. */
  refreshSession: () => Promise<Session | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthReady: false,
  refreshSession: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const initialized = useRef(false);

  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      setUser(s?.user ?? null);
      return s;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // 1. Set up the listener FIRST (per Supabase docs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        // Synchronous state update only — no async work here
        setSession(newSession);
        setUser(newSession?.user ?? null);
        // Don't set isAuthReady here; let getSession() below do it once
        // But after initial load, auth changes should still propagate
        if (isAuthReady) return;
      }
    );

    // 2. Then restore the existing session — mark ready ONLY after this completes
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setIsAuthReady(true);
    }).catch(() => {
      // Even on error, mark ready so the app doesn't hang
      setIsAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isAuthReady, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};
