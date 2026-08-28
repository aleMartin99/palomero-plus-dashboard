import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_ANON_KEY.length > 5,
);

/**
 * Browser-side Supabase client. Holds only the public anon key — it is used purely to sign
 * the admin in and keep their session fresh. All privileged data access goes through the
 * admin-dashboard-api Edge Function, authenticated with the signed JWT this client issues.
 */
export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? SUPABASE_ANON_KEY! : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

/** Current access token, refreshed by supabase-js when it's close to expiring. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
