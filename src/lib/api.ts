import type { AdminDataBundle, FeatureUsageRow, FeatureUsageUserRow } from '../types';
import type { Role } from './roles';
import { getAccessToken, isSupabaseConfigured } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

// The Edge Function is the only thing allowed to talk to Supabase with elevated privileges.
// The browser sends the signed-in admin's JWT; the function verifies it, resolves the email
// to a role, and enforces that role on every action.
const FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/admin-dashboard-api` : '';

export class AdminApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** Thrown when the signed-in email isn't on the dashboard's allowlist. */
export class NotAuthorizedError extends AdminApiError {}

async function callFunction<T>(action: string, payload?: unknown): Promise<T> {
  if (!FUNCTION_URL || !isSupabaseConfigured) {
    throw new AdminApiError('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY configuration.');
  }

  const token = await getAccessToken();
  if (!token) {
    throw new AdminApiError('Not signed in.', 401);
  }

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    if (res.status === 403) throw new NotAuthorizedError(message, 403);
    throw new AdminApiError(message, res.status);
  }
  return body as T;
}

export interface WhoAmI {
  email: string;
  role: Role;
}

/** Confirms the signed-in user is on the allowlist and returns their role. */
export function whoAmI(): Promise<WhoAmI> {
  return callFunction<WhoAmI>('whoami');
}

export function fetchAllData(): Promise<AdminDataBundle> {
  return callFunction<AdminDataBundle>('getAll');
}

export function banUser(userId: string): Promise<void> {
  return callFunction<void>('banUser', { userId });
}

export function unbanUser(userId: string): Promise<void> {
  return callFunction<void>('unbanUser', { userId });
}

export function updateContactStatus(contactId: string, status: string): Promise<void> {
  return callFunction<void>('updateContactStatus', { contactId, status });
}

export async function fetchFeatureUsage(): Promise<FeatureUsageRow[]> {
  const res = await callFunction<{ rows: FeatureUsageRow[] }>('featureUsage');
  // bigint columns can arrive as strings; normalise.
  return res.rows.map((r) => ({
    feature: r.feature,
    opens_all: Number(r.opens_all),
    users_all: Number(r.users_all),
    opens_7d: Number(r.opens_7d),
    users_7d: Number(r.users_7d),
    opens_30d: Number(r.opens_30d),
    users_30d: Number(r.users_30d),
    total_users_all: Number(r.total_users_all),
    total_users_7d: Number(r.total_users_7d),
    total_users_30d: Number(r.total_users_30d),
  }));
}

export async function fetchFeatureUsageByUser(): Promise<FeatureUsageUserRow[]> {
  const res = await callFunction<{ rows: FeatureUsageUserRow[] }>('featureUsageByUser');
  return res.rows.map((r) => ({
    user_id: r.user_id,
    feature: r.feature,
    opens_all: Number(r.opens_all),
    opens_7d: Number(r.opens_7d),
    opens_30d: Number(r.opens_30d),
    last_day: r.last_day ?? null,
  }));
}
