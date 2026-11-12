import type { AdminUser, Subscription } from '../types';
import { getUserActivePremiumSub, grantsProAccess, isProPlan } from './helpers.ts';

export type Platform = 'ios' | 'android' | 'unknown';
export type Cadence = 'monthly' | 'annual';

export interface PlatformCounts {
  ios: number;
  android: number;
  unknown: number;
  total: number;
}

export interface PlatformBreakdown {
  /** Current Pro users (access granted right now), one per user. */
  monthly: PlatformCounts;
  annual: PlatformCounts;
  total: PlatformCounts;
  /** Pro plan rows that say "active" but whose period elapsed: the app has not synced yet. */
  pendingSync: PlatformCounts;
  /** Pro plan rows that no longer grant access and are not pending sync. */
  expired: PlatformCounts;
}

const empty = (): PlatformCounts => ({ ios: 0, android: 0, unknown: 0, total: 0 });

function add(c: PlatformCounts, p: Platform) {
  c[p] += 1;
  c.total += 1;
}

export function platformOf(s: Subscription): Platform {
  return s.platform === 'ios' || s.platform === 'android' ? s.platform : 'unknown';
}

export function cadenceOf(planId: string): Cadence {
  return /annual|yearly/.test(planId) ? 'annual' : 'monthly';
}

/**
 * Counts Pro users by plan cadence and store. Mirrors the Subscriptions page: only non-deleted
 * users count, and "current Pro" uses the same `grantsProAccess` as everywhere else. Users with
 * no current Pro access are bucketed by their latest Pro row (pending sync vs expired).
 */
export function buildPlatformBreakdown(
  users: AdminUser[],
  subscriptions: Subscription[],
): PlatformBreakdown {
  const out: PlatformBreakdown = {
    monthly: empty(),
    annual: empty(),
    total: empty(),
    pendingSync: empty(),
    expired: empty(),
  };
  const byUser = new Map<string, Subscription[]>();
  for (const s of subscriptions) {
    const list = byUser.get(s.user_id);
    if (list) list.push(s);
    else byUser.set(s.user_id, [s]);
  }
  for (const u of users) {
    if (u.account_status === 'deleted') continue;
    const subs = byUser.get(u.id) ?? [];
    const active = getUserActivePremiumSub(subs, u.id);
    if (active) {
      const p = platformOf(active);
      add(cadenceOf(active.plan_id) === 'annual' ? out.annual : out.monthly, p);
      add(out.total, p);
      continue;
    }
    const lapsed = subs.filter((s) => isProPlan(s.plan_id) && !grantsProAccess(s));
    if (lapsed.length === 0) continue;
    const latest = lapsed.reduce((a, b) =>
      (b.end_date || b.expires_at || '') > (a.end_date || a.expires_at || '') ? b : a,
    );
    add(latest.status === 'active' ? out.pendingSync : out.expired, platformOf(latest));
  }
  return out;
}
