import type { AdminDataBundle } from '../types';
import { getStoredAdminSecret } from './adminSecret';

const DEFAULT_SUPABASE_URL = 'https://uhetvehxmnexfkxpenfi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_QZpvvYtj5pu9dO9qgvcdrA_rAU-w2lX';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_ANON_KEY;

// The Edge Function is the only thing allowed to talk to Supabase with elevated
// privileges. The browser only ever holds the public anon key (safe to ship) and the
// admin-secret (low-privilege, revocable, checked by the function itself).
const FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/admin-dashboard-api` : '';

export class AdminApiError extends Error {}

async function callFunction<T>(action: string, payload?: unknown): Promise<T> {
  const secret = getStoredAdminSecret();
  if (!FUNCTION_URL || !SUPABASE_ANON_KEY) {
    throw new AdminApiError('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY configuration.');
  }
  if (!secret) {
    throw new AdminApiError('No admin access key configured.');
  }

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-admin-secret': secret,
    },
    body: JSON.stringify({ action, payload }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminApiError(body?.error || `Request failed (${res.status})`);
  }
  return body as T;
}

export function isConfigured(): boolean {
  return Boolean(FUNCTION_URL && SUPABASE_ANON_KEY && getStoredAdminSecret());
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
