import type { AdminUser, FeatureUsageUserRow, Pigeon, Subscription } from '../types';
import {
  effectiveEndDate,
  getUserActivePremiumSub,
  hasLapsedProSub,
  isVerified,
} from './helpers.ts';
import { LEADS_CONFIG } from './leadsConfig.ts';
import type { LeadReason, LeadsConfig } from './leadsConfig.ts';

export type LeadPlan = 'free' | 'churning' | 'lapsed';

export interface Lead {
  userId: string;
  displayName: string;
  loftName: string | null;
  email: string;
  contactType: string | null;
  contactValue: string | null;
  plan: LeadPlan;
  pigeons: number;
  forSale: number;
  opens30: number;
  lastActive: string | null; // 'YYYY-MM-DD'
  score: number;
  reasons: LeadReason[];
}

export interface BuildLeadsInput {
  users: AdminUser[];
  pigeons: Pigeon[];
  subscriptions: Subscription[];
  usage: FeatureUsageUserRow[];
  now: Date;
}

const DAY_MS = 86_400_000;

function isChurning(sub: Subscription, now: Date, windowDays: number): boolean {
  if (sub.status === 'cancelled') return true;
  const end = effectiveEndDate(sub);
  return end !== null && end.getTime() - now.getTime() <= windowDays * DAY_MS;
}

/**
 * Ranks upgrade/retention leads. Pro is decided by the panel's existing helpers, so the
 * numbers here always agree with the Subscriptions and Overview pages.
 */
export function buildLeads(input: BuildLeadsInput, config: LeadsConfig = LEADS_CONFIG): Lead[] {
  const { users, pigeons, subscriptions, usage, now } = input;

  const pigeonStats = new Map<string, { total: number; forSale: number }>();
  for (const p of pigeons) {
    const s = pigeonStats.get(p.user_id) ?? { total: 0, forSale: 0 };
    s.total += 1;
    if (p.sale_status === 'forSale') s.forSale += 1;
    pigeonStats.set(p.user_id, s);
  }

  const usageByUser = new Map<string, FeatureUsageUserRow[]>();
  for (const r of usage) {
    const list = usageByUser.get(r.user_id);
    if (list) list.push(r);
    else usageByUser.set(r.user_id, [r]);
  }

  const leads: Lead[] = [];
  for (const u of users) {
    if (u.account_status !== 'active' || !isVerified(u)) continue;

    const activeSub = getUserActivePremiumSub(subscriptions, u.id);
    const churning = activeSub !== undefined && isChurning(activeSub, now, config.churnWindowDays);
    if (activeSub && !churning) continue; // healthy Pro: not a lead

    const lapsed = !activeSub && hasLapsedProSub(subscriptions, u.id);
    const plan: LeadPlan = activeSub ? 'churning' : lapsed ? 'lapsed' : 'free';

    const stats = pigeonStats.get(u.id) ?? { total: 0, forSale: 0 };
    const rows = usageByUser.get(u.id) ?? [];
    const opens30 = rows.reduce((n, r) => n + r.opens_30d, 0);
    const opens7 = rows.reduce((n, r) => n + r.opens_7d, 0);
    const lastActive = rows.reduce<string | null>(
      (best, r) => (r.last_day && (best === null || r.last_day > best) ? r.last_day : best),
      null,
    );
    const heavy = rows.some(
      (r) =>
        config.proLeaningFeatures.includes(r.feature) && r.opens_30d >= config.heavyOpensThreshold,
    );

    const reasons: LeadReason[] = [];
    if (!activeSub && stats.total >= config.freePigeonLimit) reasons.push('at_limit');
    if (plan !== 'free') reasons.push('churn_risk');
    if (heavy) reasons.push('heavy_pro_feature');
    if (stats.forSale > 0) reasons.push('has_for_sale');
    if (opens7 > 0) reasons.push('recently_active');

    const score = reasons.reduce((n, r) => n + config.points[r], 0);
    if (score === 0) continue;

    leads.push({
      userId: u.id,
      displayName: u.display_name,
      loftName: u.loft_name ?? null,
      email: u.email,
      contactType: u.contact_type ?? null,
      contactValue: u.contact_value ?? null,
      plan,
      pigeons: stats.total,
      forSale: stats.forSale,
      opens30,
      lastActive,
      score,
      reasons,
    });
  }

  return leads.sort(
    (a, b) =>
      b.score - a.score ||
      (b.lastActive ?? '').localeCompare(a.lastActive ?? '') ||
      a.displayName.localeCompare(b.displayName),
  );
}

const HTTP_URL = /^https?:\/\//i;
const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Turns the user's marketplace contact field into a safe link, or null when the type is
 * unknown or the value looks wrong. Only http(s), tel: and mailto: links are ever produced.
 */
export function contactLink(
  type: string | null | undefined,
  value: string | null | undefined,
): string | null {
  const v = (value ?? '').trim();
  if (!type || !v) return null;
  switch (type.toLowerCase()) {
    case 'whatsapp': {
      if (HTTP_URL.test(v)) return v;
      if (OTHER_SCHEME.test(v)) return null; // e.g. javascript:, data:
      const digits = v.replace(/\D/g, '');
      return digits ? `https://wa.me/${digits}` : null;
    }
    case 'phone': {
      const d = v.replace(/[^\d+]/g, '');
      return d ? `tel:${d}` : null;
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+$/.test(v) ? `mailto:${v}` : null;
    case 'instagram': {
      if (HTTP_URL.test(v)) return v;
      const handle = v.replace(/^@/, '');
      return handle ? `https://instagram.com/${encodeURIComponent(handle)}` : null;
    }
    default:
      return null;
  }
}
