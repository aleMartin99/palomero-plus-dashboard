// The admin secret is a low-privilege, revocable key (x-admin-secret) checked by the
// admin-dashboard-api Edge Function. It is NOT the Supabase service_role key — that key
// now lives only on the server side (Supabase's edge runtime), never in this browser bundle
// or in localStorage. See supabase/functions/admin-dashboard-api for details.
const STORAGE_KEY = 'palomero_admin_dashboard_secret';

export function getStoredAdminSecret(): string {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setStoredAdminSecret(secret: string): void {
  localStorage.setItem(STORAGE_KEY, secret);
}

export function clearStoredAdminSecret(): void {
  localStorage.removeItem(STORAGE_KEY);
}
