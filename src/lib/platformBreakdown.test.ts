import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlatformBreakdown, cadenceOf, platformOf } from './platformBreakdown.ts';
import type { AdminUser, Subscription } from '../types';

const future = new Date(Date.now() + 30 * 864e5).toISOString();
const past = new Date(Date.now() - 30 * 864e5).toISOString();
const user = (id: string, account_status = 'active') => ({ id, account_status }) as AdminUser;
const sub = (o: Partial<Subscription> & { user_id: string; plan_id: string }): Subscription =>
  ({ id: `${o.user_id}-${o.plan_id}`, user_email: '', status: 'active', ...o }) as Subscription;

describe('platformBreakdown', () => {
  it('splits current Pro by cadence and platform, one count per user', () => {
    const users = [user('a'), user('b'), user('c'), user('d')];
    const subs = [
      sub({ user_id: 'a', plan_id: 'pro_monthly', platform: 'ios', end_date: future }),
      sub({ user_id: 'b', plan_id: 'pro_monthly', platform: 'android', end_date: future }),
      sub({ user_id: 'c', plan_id: 'pro_annual', platform: 'ios', end_date: future }),
      sub({ user_id: 'd', plan_id: 'pro_annual', platform: null, end_date: future }),
      sub({ user_id: 'd', plan_id: 'pro_monthly', platform: 'ios', status: 'expired', end_date: past }),
    ];
    const r = buildPlatformBreakdown(users, subs);
    assert.deepEqual(r.monthly, { ios: 1, android: 1, unknown: 0, total: 2 });
    assert.deepEqual(r.annual, { ios: 1, android: 0, unknown: 1, total: 2 });
    assert.equal(r.total.total, 4);
  });

  it('buckets lapsed rows as pending sync or expired and skips deleted users and free rows', () => {
    const users = [user('a'), user('b'), user('c'), user('d', 'deleted')];
    const subs = [
      sub({ user_id: 'a', plan_id: 'pro_monthly', platform: 'ios', status: 'active', end_date: past }),
      sub({ user_id: 'b', plan_id: 'pro_annual', platform: 'android', status: 'expired', end_date: past }),
      sub({ user_id: 'c', plan_id: 'free' }),
      sub({ user_id: 'd', plan_id: 'pro_monthly', platform: 'ios', end_date: future }),
    ];
    const r = buildPlatformBreakdown(users, subs);
    assert.equal(r.total.total, 0);
    assert.deepEqual(r.pendingSync, { ios: 1, android: 0, unknown: 0, total: 1 });
    assert.deepEqual(r.expired, { ios: 0, android: 1, unknown: 0, total: 1 });
  });

  it('helpers', () => {
    assert.equal(cadenceOf('pro_annual'), 'annual');
    assert.equal(cadenceOf('plan_premium_yearly'), 'annual');
    assert.equal(cadenceOf('pro_monthly'), 'monthly');
    assert.equal(platformOf({ platform: 'web' } as unknown as Subscription), 'unknown');
  });
});
