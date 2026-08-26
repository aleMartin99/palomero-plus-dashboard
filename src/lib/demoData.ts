import type { AdminDataBundle } from '../types';

// Offline / not-yet-connected demo data, ported from the original app.js loadFallbackDemo().
export const demoData: AdminDataBundle = {
  users: [
    { id: '1', email: 'juan.perez@fancier.com', username: 'juanito_pigeons', display_name: 'Juan Pérez', is_public: true, account_status: 'active', email_confirmed_at: '2026-06-15T12:00:00Z', created_at: '2026-06-15T10:00:00Z' },
    { id: '2', email: 'maria.gomez@loft.es', username: 'maria_g', display_name: 'María Gómez', is_public: true, account_status: 'active', email_confirmed_at: '2026-07-01T15:30:00Z', created_at: '2026-07-01T14:00:00Z' },
    { id: '3', email: 'carlos.fancier@pigeons.net', username: 'carlos_p', display_name: 'Carlos Pigeon', is_public: false, account_status: 'inactive', email_confirmed_at: null, created_at: '2026-07-08T08:00:00Z' },
    { id: '4', email: 'deleted.user@domain.com', username: 'removed_fancier', display_name: 'Deleted Fancier', is_public: false, account_status: 'deleted', email_confirmed_at: '2026-05-10T11:00:00Z', created_at: '2026-05-10T09:00:00Z' },
  ],
  pigeons: [
    { id: 'p1', user_id: '1', name: 'Rayo', ring_number: 'ESP-2025-883', sex: 'M' },
    { id: 'p2', user_id: '1', name: 'Centella', ring_number: 'ESP-2025-884', sex: 'F' },
    { id: 'p3', user_id: '2', name: 'Azul', ring_number: 'ESP-2026-112', sex: 'M' },
    { id: 'p4', user_id: '2', name: 'Pluma', ring_number: 'ESP-2026-115', sex: 'F' },
  ],
  captures: [
    { id: 'c1', user_id: '1', pigeon_id: 'p1', captured_at: '2026-07-05T18:22:00Z' },
    { id: 'c2', user_id: '2', pigeon_id: 'p3', captured_at: '2026-07-09T10:45:00Z' },
  ],
  contactRequests: [
    { id: '1', user_id: '1', user_email: 'juan.perez@fancier.com', subject: 'Problem with uploading loft image', type: 'bug', description: 'When I try to select a custom image for my loft, the app gets stuck loading.', status: 'new' },
    { id: '2', user_id: '2', user_email: 'maria.gomez@loft.es', subject: 'Requesting weather feature', type: 'feedback', description: 'It would be nice to see the weather forecast directly in the ranking screen.', status: 'pending' },
    { id: '3', user_id: '3', user_email: 'carlos.fancier@pigeons.net', subject: 'Forgot verification email link', type: 'support', description: 'I did not receive the verification code on signup. Can you check my email?', status: 'solved' },
  ],
  // Plan ids mirror the real subscription_plans table so demo mode exercises the same
  // code paths as production.
  plans: [
    { id: 'free', name: 'Free', price_usd: 0, is_active: true },
    { id: 'pro_monthly', name: 'Pro Monthly', price_usd: 4.99, is_active: true },
    { id: 'pro_annual', name: 'Pro Annual', price_usd: 49.99, is_active: true },
  ],
  subscriptions: [
    // Currently Pro.
    { id: 'sub1', user_id: '2', user_email: 'maria.gomez@loft.es', plan_id: 'pro_annual', status: 'active', end_date: '2027-07-01T15:30:00Z' },
    // status still says 'active' but the period ended — the app treats this user as free,
    // so the dashboard must too. Keeps the "lapsed (stale status)" path visible in demo mode.
    { id: 'sub2', user_id: '1', user_email: 'juan.perez@fancier.com', plan_id: 'pro_monthly', status: 'active', end_date: '2026-08-15T12:00:00Z' },
    // Cancelled but still inside the paid period — still Pro.
    { id: 'sub3', user_id: '3', user_email: 'carlos.fancier@pigeons.net', plan_id: 'pro_monthly', status: 'cancelled', end_date: '2027-01-01T00:00:00Z' },
    { id: 'sub4', user_id: '4', user_email: 'deleted.user@domain.com', plan_id: 'free', status: 'active', end_date: null },
  ],
};
