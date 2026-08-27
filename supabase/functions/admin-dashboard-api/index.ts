// Edge Function: admin-dashboard-api
//
// Backs the React admin dashboard. All privileged Supabase access (auth.admin.listUsers,
// full-table reads/writes that bypass RLS) happens HERE, server-side, using the
// SUPABASE_SERVICE_ROLE_KEY that Supabase injects automatically into every Edge Function's
// environment. That key never reaches the browser.
//
// The browser instead sends:
//   - Authorization: Bearer <anon/publishable key>   (required by the Supabase gateway itself)
//   - x-admin-secret: <ADMIN_DASHBOARD_KEY>            (low-privilege, revocable — set this as an
//                                                        Edge Function secret; rotate any time by
//                                                        redeploying the secret, no code change needed)
//
// This mirrors the pattern already used by send-official-email (x-admin-secret + ADMIN_API_KEY),
// but with its own dedicated secret (ADMIN_DASHBOARD_KEY) so the two functions don't share a
// blast radius.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// PostgREST caps every .select() at 1000 rows by default (db-max-rows). A plain
// .select('*') therefore SILENTLY truncates any table past 1000 rows — which is exactly
// how the dashboard ended up under-reporting subscriptions. Page through with .range()
// until a short page comes back.
const PAGE_SIZE = 1000;

async function fetchAllRows(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  table: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error(`[admin-dashboard-api] Error reading ${table} at offset ${from}:`, error);
      throw error;
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ADMIN_DASHBOARD_KEY = Deno.env.get('ADMIN_DASHBOARD_KEY');

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the function environment.' }, 500);
  }
  if (!ADMIN_DASHBOARD_KEY) {
    return json({ error: 'Missing ADMIN_DASHBOARD_KEY secret. Set it with: supabase secrets set ADMIN_DASHBOARD_KEY=... ' }, 500);
  }

  const clientSecret = req.headers.get('x-admin-secret');
  if (clientSecret !== ADMIN_DASHBOARD_KEY) {
    return json({ error: "Unauthorized. Missing or invalid 'x-admin-secret' header." }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { action, payload } = await req.json();

    switch (action) {
      case 'getAll': {
        // 1. Auth users (requires service_role) + public profile join.
        // auth.admin.listUsers() is PAGINATED (defaults to 50/page) — a single call silently
        // truncates the list on any project with more than 50 users, which throws off every
        // per-user stat downstream (verified %, pigeons/user, subscription tiers, ...). Page
        // through all of it.
        let authUsers: Array<{ id: string; email?: string; email_confirmed_at?: string | null; created_at: string }> = [];
        try {
          const perPage = 1000;
          for (let page = 1; ; page++) {
            const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
            if (error) {
              console.warn('[admin-dashboard-api] listUsers page error, stopping pagination.', error);
              break;
            }
            const batch = data?.users ?? [];
            authUsers.push(...batch);
            if (batch.length < perPage) break; // last page
          }
        } catch (e) {
          console.warn('[admin-dashboard-api] Could not list auth users, falling back to profiles.', e);
        }

        const publicProfiles = await fetchAllRows(supabase, 'users');
        // Index by id so the join below is O(1) per user rather than O(n) — at 1400+ users
        // on both sides a nested .find() is a needless ~2M comparisons.
        const profileById = new Map(publicProfiles.map((p) => [p.id as string, p]));

        let users;
        if (authUsers.length > 0) {
          users = authUsers.map((au) => {
            // deno-lint-ignore no-explicit-any
            const profile = profileById.get(au.id) as any;
            return {
              id: au.id,
              email: au.email,
              username: profile?.username || 'fancier',
              display_name: profile?.display_name || au.email?.split('@')[0] || 'Fancier',
              is_public: profile?.is_public ?? true,
              account_status: profile?.account_status || 'active',
              email_confirmed_at: au.email_confirmed_at ?? null,
              created_at: au.created_at,
            };
          });
        } else {
          users = publicProfiles.map((p: Record<string, unknown>) => ({
            id: p.id,
            email: `${p.username || 'fancier'}@fancier.com`,
            username: p.username || 'fancier',
            display_name: p.display_name || p.username || 'Fancier',
            is_public: p.is_public ?? true,
            account_status: p.account_status || 'active',
            email_confirmed_at: p.created_at,
            created_at: p.created_at,
          }));
        }

        const [pigeons, captures, contacts, plans, subscriptions] = await Promise.all([
          fetchAllRows(supabase, 'pigeons'),
          fetchAllRows(supabase, 'captures'),
          fetchAllRows(supabase, 'contact_requests'),
          fetchAllRows(supabase, 'subscription_plans'),
          fetchAllRows(supabase, 'subscriptions'),
        ]);

        const emailById = new Map(users.map((u) => [u.id as string, u.email]));
        const emailFor = (userId: string) => emailById.get(userId) || 'Unknown Fancier';

        return json({
          users,
          pigeons,
          captures,
          contactRequests: contacts.map((c) => ({ ...c, user_email: emailFor(c.user_id as string) })),
          plans,
          subscriptions: subscriptions.map((s) => ({ ...s, user_email: emailFor(s.user_id as string) })),
        });
      }

      case 'banUser': {
        const { userId } = payload ?? {};
        if (!userId) return json({ error: 'Missing userId.' }, 400);
        const { error } = await supabase.from('users').update({ account_status: 'inactive' }).eq('id', userId);
        if (error) throw error;
        return json({ success: true });
      }

      case 'unbanUser': {
        const { userId } = payload ?? {};
        if (!userId) return json({ error: 'Missing userId.' }, 400);
        const { error } = await supabase.from('users').update({ account_status: 'active' }).eq('id', userId);
        if (error) throw error;
        return json({ success: true });
      }

      case 'updateContactStatus': {
        const { contactId, status } = payload ?? {};
        if (!contactId || !status) return json({ error: 'Missing contactId or status.' }, 400);
        const allowed = new Set(['new', 'pending', 'solved', 'closed']);
        if (!allowed.has(status)) return json({ error: 'Invalid status.' }, 400);
        const { error } = await supabase.from('contact_requests').update({ status }).eq('id', contactId);
        if (error) throw error;
        return json({ success: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error('[admin-dashboard-api] Unhandled error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error occurred' }, 500);
  }
});
