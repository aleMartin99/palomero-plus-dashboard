// Edge Function: admin-dashboard-api
//
// Backs the React admin dashboard. All privileged Supabase access (auth.admin.listUsers,
// full-table reads/writes that bypass RLS) happens HERE, server-side, using the
// SUPABASE_SERVICE_ROLE_KEY that Supabase injects automatically into every Edge Function's
// environment. That key never reaches the browser.
//
// Authenticates each request by verifying the signed-in user's JWT token and checking their
// email against the ADMIN_ROLES environment secret allowlist.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the function environment.' }, 500);
  }

  // 1. Verify User JWT from Authorization Header
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return json({ error: 'Unauthorized: Missing Authorization header.' }, 401);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user || !user.email) {
    return json({ error: 'Unauthorized: Invalid or expired session token.' }, 401);
  }

  // 2. Check ADMIN_ROLES Allowlist
  const rolesJson = Deno.env.get('ADMIN_ROLES') || '{}';
  let adminRoles: Record<string, 'owner' | 'viewer'> = {};
  try {
    const parsed = JSON.parse(rolesJson);
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && typeof v === 'string') {
        adminRoles[k.toLowerCase()] = (v.toLowerCase() === 'owner' ? 'owner' : 'viewer');
      }
    }
  } catch (e) {
    console.error('[admin-dashboard-api] Failed to parse ADMIN_ROLES secret:', e);
  }

  const userEmail = user.email.toLowerCase();
  const role = adminRoles[userEmail];

  if (!role) {
    return json({ error: `Forbidden: Email ${user.email} is not authorized on the dashboard allowlist.` }, 403);
  }

  try {
    const { action, payload } = await req.json();

    switch (action) {
      case 'whoami': {
        return json({ email: user.email, role });
      }

      case 'getAll': {
        let authUsers: Array<{ id: string; email?: string; email_confirmed_at?: string | null; created_at: string }> = [];
        try {
          const perPage = 1000;
          for (let page = 1; ; page++) {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
            if (error) {
              console.warn('[admin-dashboard-api] listUsers page error, stopping pagination.', error);
              break;
            }
            const batch = data?.users ?? [];
            authUsers.push(...batch);
            if (batch.length < perPage) break;
          }
        } catch (e) {
          console.warn('[admin-dashboard-api] Could not list auth users, falling back to profiles.', e);
        }

        const publicProfiles = await fetchAllRows(supabaseAdmin, 'users');
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
          fetchAllRows(supabaseAdmin, 'pigeons'),
          fetchAllRows(supabaseAdmin, 'captures'),
          fetchAllRows(supabaseAdmin, 'contact_requests'),
          fetchAllRows(supabaseAdmin, 'subscription_plans'),
          fetchAllRows(supabaseAdmin, 'subscriptions'),
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
        if (role !== 'owner') return json({ error: 'Forbidden: Requires owner role.' }, 403);
        const { userId } = payload ?? {};
        if (!userId) return json({ error: 'Missing userId.' }, 400);
        const { error } = await supabaseAdmin.from('users').update({ account_status: 'inactive' }).eq('id', userId);
        if (error) throw error;
        return json({ success: true });
      }

      case 'unbanUser': {
        if (role !== 'owner') return json({ error: 'Forbidden: Requires owner role.' }, 403);
        const { userId } = payload ?? {};
        if (!userId) return json({ error: 'Missing userId.' }, 400);
        const { error } = await supabaseAdmin.from('users').update({ account_status: 'active' }).eq('id', userId);
        if (error) throw error;
        return json({ success: true });
      }

      case 'updateContactStatus': {
        if (role !== 'owner') return json({ error: 'Forbidden: Requires owner role.' }, 403);
        const { contactId, status } = payload ?? {};
        if (!contactId || !status) return json({ error: 'Missing contactId or status.' }, 400);
        const allowed = new Set(['new', 'pending', 'solved', 'closed']);
        if (!allowed.has(status)) return json({ error: 'Invalid status.' }, 400);
        const { error } = await supabaseAdmin.from('contact_requests').update({ status }).eq('id', contactId);
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
