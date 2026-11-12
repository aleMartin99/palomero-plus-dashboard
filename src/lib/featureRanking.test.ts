import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { projectSummary, rankByGroup } from './featureRanking.ts';
import type { FeatureUsageRow, FeatureUsageUserRow } from '../types';

const summary = (feature: string, over: Partial<FeatureUsageRow> = {}): FeatureUsageRow => ({
  feature,
  opens_all: 0,
  users_all: 0,
  opens_7d: 0,
  users_7d: 0,
  opens_30d: 0,
  users_30d: 0,
  total_users_all: 10,
  total_users_7d: 5,
  total_users_30d: 8,
  ...over,
});

const u = (user_id: string, feature: string, o30: number, o7 = 0, all = o30): FeatureUsageUserRow => ({
  user_id,
  feature,
  opens_all: all,
  opens_7d: o7,
  opens_30d: o30,
  last_day: '2026-11-10',
});

describe('projectSummary', () => {
  it('ranks by opens, hides zero-open features and computes share and per-user', () => {
    const rows = [
      summary('home', { opens_30d: 40, users_30d: 4 }),
      summary('loft', { opens_30d: 80, users_30d: 8 }),
      summary('rankings', { opens_30d: 0, users_30d: 0 }),
    ];
    const r = projectSummary(rows, '30d');
    assert.deepEqual(r.map((x) => x.feature), ['loft', 'home']);
    assert.equal(r[0].rank, 1);
    assert.equal(r[0].share, 1); // 8 of 8
    assert.equal(r[0].perUser, 10); // 80 / 8
  });

  it('breaks ties by users, then name, and survives a zero total', () => {
    const rows = [
      summary('b', { opens_all: 5, users_all: 1, total_users_all: 0 }),
      summary('a', { opens_all: 5, users_all: 1, total_users_all: 0 }),
      summary('c', { opens_all: 5, users_all: 3, total_users_all: 0 }),
    ];
    const r = projectSummary(rows, 'all');
    assert.deepEqual(r.map((x) => x.feature), ['c', 'a', 'b']);
    assert.equal(r[0].share, 0);
    assert.equal(r[0].perUser, 0);
  });
});

describe('rankByGroup', () => {
  const pro = new Set(['p1', 'p2']);
  const usage = [
    u('p1', 'health_assistant', 30),
    u('p2', 'health_assistant', 10),
    u('p2', 'loft', 8),
    u('f1', 'loft', 100),
    u('f2', 'home', 5),
  ];

  it('ranks only Pro users and uses active Pro users as the denominator', () => {
    const r = rankByGroup(usage, pro, 'pro', '30d');
    assert.deepEqual(r.map((x) => x.feature), ['health_assistant', 'loft']);
    assert.equal(r[0].opens, 40);
    assert.equal(r[0].users, 2);
    assert.equal(r[0].share, 1); // 2 of 2 active Pro users
    assert.equal(r[0].perUser, 20); // 40 / 2
    assert.equal(r[1].opens, 8);
    assert.equal(r[1].share, 0.5);
  });

  it('ranks only Free users', () => {
    const r = rankByGroup(usage, pro, 'free', '30d');
    assert.deepEqual(r.map((x) => x.feature), ['loft', 'home']);
    assert.equal(r[0].opens, 100);
  });

  it('honours the period (7d window ignores users with no recent opens)', () => {
    const r = rankByGroup([u('p1', 'loft', 9, 0), u('p2', 'loft', 9, 3)], pro, 'pro', '7d');
    assert.equal(r.length, 1);
    assert.equal(r[0].opens, 3);
    assert.equal(r[0].users, 1);
    assert.equal(r[0].share, 1);
  });

  it('returns an empty list when the group has no usage', () => {
    assert.deepEqual(rankByGroup([u('f1', 'loft', 5)], pro, 'pro', 'all'), []);
  });
});
