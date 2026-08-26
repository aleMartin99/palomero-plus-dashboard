import type { AdminUser, Subscription, SubscriptionPlan } from '../types';

// Plan ids that grant Pro access. Mirrors SubscriptionPlanType.isPro in the Flutter app
// (pigeon_track/lib/features/subscription/models/subscription.dart). The legacy
// plan_premium_* ids are kept only so the offline demo data still resolves.
const PRO_PLAN_IDS = new Set([
  'pro_monthly',
  'pro_annual',
  'plan_premium_monthly',
  'plan_premium_yearly',
]);

export function isProPlan(planId?: string | null): boolean {
  return Boolean(planId && PRO_PLAN_IDS.has(planId));
}

/**
 * Resolve a subscription's end date, replicating the app's midnight quirk: an end_date at
 * exactly 00:00:00 is a date-only value and is treated as the END of that day (23:59:59.999),
 * so a subscription doesn't read as expired for the whole final day it's still valid.
 */
function effectiveEndDate(s: Subscription): Date | null {
  const raw = s.end_date || s.expires_at;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  }
  return d;
}

/**
 * Whether a subscription currently grants Pro access — the dashboard's single source of truth,
 * deliberately identical to `Subscription.isPro` in the app so admin numbers match what users
 * actually experience:
 *   - status 'active'    → Pro while end_date is null or still in the future
 *   - status 'cancelled' → Pro until end_date passes (the grace period they already paid for)
 *   - anything else      → not Pro
 *
 * Note this intentionally does NOT trust `status` alone: rows left at 'active' with an elapsed
 * end_date are lapsed users, and the app treats them as free.
 */
export function grantsProAccess(s: Subscription): boolean {
  if (!isProPlan(s.plan_id)) return false;
  const end = effectiveEndDate(s);
  const now = new Date();
  if (s.status === 'active') return !end || end > now;
  if (s.status === 'cancelled') return end !== null && end > now;
  return false;
}

/** The subscription currently granting this user Pro access, if any. */
export function getUserActivePremiumSub(
  subscriptions: Subscription[],
  userId: string,
): Subscription | undefined {
  return subscriptions.find((s) => s.user_id === userId && grantsProAccess(s));
}

/** A user is Pro if any of their subscriptions grants access; everyone else is Free. */
export function isProUser(subscriptions: Subscription[], userId: string): boolean {
  return getUserActivePremiumSub(subscriptions, userId) !== undefined;
}

/** Users who once had a Pro plan but whose access has lapsed (no current Pro sub). */
export function hasLapsedProSub(subscriptions: Subscription[], userId: string): boolean {
  if (isProUser(subscriptions, userId)) return false;
  return subscriptions.some((s) => s.user_id === userId && isProPlan(s.plan_id));
}

export function planDisplayName(plan?: SubscriptionPlan, planId?: string): string {
  if (plan) return plan.name;
  if (planId === 'pro_annual' || planId === 'plan_premium_yearly') return 'Pro Annual';
  if (planId === 'pro_monthly' || planId === 'plan_premium_monthly') return 'Pro Monthly';
  if (planId === 'free' || planId === 'plan_free') return 'Free';
  return planId || 'Unknown Plan';
}

/** Inverse of grantsProAccess, for labelling a row in the transactions table. */
export function isSubscriptionExpired(s: Subscription): boolean {
  return !grantsProAccess(s);
}

export function formatDate(value?: string | null): string {
  if (!value) return '--';
  return value.substring(0, 10);
}

export function isVerified(u: AdminUser): boolean {
  return u.email_confirmed_at !== null && u.email_confirmed_at !== undefined;
}

export function initialOf(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}
