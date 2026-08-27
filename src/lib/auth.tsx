import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { whoAmI, NotAuthorizedError } from './api';
import { permissionsFor, type Permissions, type Role } from './roles';

interface AuthState {
  session: Session | null;
  email: string | null;
  role: Role | null;
  permissions: Permissions;
  /** Signed in with Supabase but the email isn't on the dashboard allowlist. */
  unauthorized: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ask the Edge Function who we are. The role comes from the server allowlist, never from
  // anything the browser could set — the client is only told what it already has to obey.
  const resolveRole = useCallback(async (current: Session | null) => {
    if (!current) {
      setRole(null);
      setUnauthorized(false);
      return;
    }
    try {
      const me = await whoAmI();
      setRole(me.role);
      setUnauthorized(false);
    } catch (e) {
      setRole(null);
      setUnauthorized(e instanceof NotAuthorizedError);
      if (!(e instanceof NotAuthorizedError)) {
        console.error('Could not resolve dashboard role.', e);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await resolveRole(data.session);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // TOKEN_REFRESHED fires on a timer and doesn't change identity — re-querying the role
      // on every refresh would be a pointless request every hour.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setLoading(true);
        resolveRole(next).finally(() => setLoading(false));
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [resolveRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setRole(null);
    setUnauthorized(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      email: session?.user?.email ?? null,
      role,
      permissions: permissionsFor(role),
      unauthorized,
      loading,
      signIn,
      signOut,
    }),
    [session, role, unauthorized, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
