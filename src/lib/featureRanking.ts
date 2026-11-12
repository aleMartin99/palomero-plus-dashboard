import type { FeatureUsageRow, FeatureUsageUserRow } from '../types';

export type Period = '7d' | '30d' | 'all';
export type Group = 'all' | 'pro' | 'free';

export interface RankedRow {
  key: string;
  rank: number;
  feature: string;
  opens: number;
  users: number;
  share: number; // 0..1 of active users in the period (and group)
  perUser: number; // opens per active user
}

type Unranked = Omit<RankedRow, 'key' | 'rank'>;

function rank(rows: Unranked[]): RankedRow[] {
  return rows
    .filter((r) => r.opens > 0)
    .sort((a, b) => b.opens - a.opens || b.users - a.users || a.feature.localeCompare(b.feature))
    .map((r, i) => ({ ...r, key: r.feature, rank: i + 1 }));
}

/** Ranking from the all-users summary RPC (the "All" group). */
export function projectSummary(rows: FeatureUsageRow[], period: Period): RankedRow[] {
  return rank(
    rows.map((r) => {
      const opens = period === '7d' ? r.opens_7d : period === '30d' ? r.opens_30d : r.opens_all;
      const users = period === '7d' ? r.users_7d : period === '30d' ? r.users_30d : r.users_all;
      const total =
        period === '7d' ? r.total_users_7d : period === '30d' ? r.total_users_30d : r.total_users_all;
      return {
        feature: r.feature,
        opens,
        users,
        share: total > 0 ? users / total : 0,
        perUser: total > 0 ? opens / total : 0,
      };
    }),
  );
}

/** Ranking of one plan group from per-user rows; the denominator is that group's active users. */
export function rankByGroup(
  usage: FeatureUsageUserRow[],
  proIds: ReadonlySet<string>,
  group: 'pro' | 'free',
  period: Period,
): RankedRow[] {
  const wantPro = group === 'pro';
  const opensOf = (r: FeatureUsageUserRow) =>
    period === '7d' ? r.opens_7d : period === '30d' ? r.opens_30d : r.opens_all;

  const perFeature = new Map<string, { opens: number; users: Set<string> }>();
  const activeUsers = new Set<string>();
  for (const r of usage) {
    if (proIds.has(r.user_id) !== wantPro) continue;
    const opens = opensOf(r);
    if (opens <= 0) continue;
    activeUsers.add(r.user_id);
    const entry = perFeature.get(r.feature) ?? { opens: 0, users: new Set<string>() };
    entry.opens += opens;
    entry.users.add(r.user_id);
    perFeature.set(r.feature, entry);
  }

  const total = activeUsers.size;
  return rank(
    [...perFeature].map(([feature, e]) => ({
      feature,
      opens: e.opens,
      users: e.users.size,
      share: total > 0 ? e.users.size / total : 0,
      perUser: total > 0 ? e.opens / total : 0,
    })),
  );
}
