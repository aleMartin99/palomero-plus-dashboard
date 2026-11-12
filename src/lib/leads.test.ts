import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLeads, contactLink } from './leads.ts';
import { LEADS_CONFIG } from './leadsConfig.ts';
import type { AdminUser, FeatureUsageUserRow, Pigeon, Subscription } from '../types';

const NOW = new Date();
const iso = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

const user = (id: string, over: Partial<AdminUser> = {}): AdminUser => ({
  id,
  email: `${id}@x.com`,
  username: id,
  display_name: id.toUpperCase(),
  is_public: true,
  account_status: 'active',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

const pigeons = (userId: string, n: number, forSale = 0): Pigeon[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${userId}-p${i}`,
    user_id: userId,
    name: `p${i}`,
    ring_number: `r${i}`,
    sex: 'M',
    sale_status: i < forSale ? 'forSale' : 'notForSale',
  }));

const sub = (userId: string, over: Partial<Subscription> = {}): Subscription => ({
  id: `s-${userId}`,
  user_id: userId,
  user_email: '',
  plan_id: 'pro_monthly',
  status: 'active',
  end_date: iso(30),
  ...over,
});

const use = (
  userId: string,
  feature: string,
  o30: number,
  o7 = o30,
  all = o30,
  last = '2026-11-10',
): FeatureUsageUserRow => ({
  user_id: userId,
  feature,
  opens_all: all,
  opens_7d: o7,
  opens_30d: o30,
  last_day: last,
});

const run = (
  users: AdminUser[],
  pg: Pigeon[] = [],
  subs: Subscription[] = [],
  usage: FeatureUsageUserRow[] = [],
  config = LEADS_CONFIG,
) => buildLeads({ users, pigeons: pg, subscriptions: subs, usage, now: NOW }, config);

describe('buildLeads', () => {
  it('free user at the pigeon limit is an at_limit lead', () => {
    const [l] = run([user('a')], pigeons('a', 3));
    assert.deepEqual(l.reasons, ['at_limit']);
    assert.equal(l.score, 3);
    assert.equal(l.plan, 'free');
    assert.equal(l.pigeons, 3);
  });

  it('free user below the limit with no other signal is not a lead', () => {
    assert.equal(run([user('a')], pigeons('a', 2)).length, 0);
  });

  it('free user with nothing at all is not a lead', () => {
    assert.equal(run([user('a')]).length, 0);
  });

  it('a pigeon for sale scores has_for_sale', () => {
    const [l] = run([user('a')], pigeons('a', 1, 1));
    assert.deepEqual(l.reasons, ['has_for_sale']);
    assert.equal(l.score, 2);
    assert.equal(l.forSale, 1);
  });

  it('heavy use of a Pro-leaning feature needs the threshold (10 yes, 9 no)', () => {
    const yes = run([user('a')], [], [], [use('a', 'health_assistant', 10, 0, 10)]);
    assert.deepEqual(yes[0].reasons, ['heavy_pro_feature']);
    const no = run([user('a')], [], [], [use('a', 'health_assistant', 9, 0, 9)]);
    assert.equal(no.length, 0);
  });

  it('non Pro-leaning features do not count as heavy use', () => {
    assert.equal(run([user('a')], [], [], [use('a', 'home', 50, 0, 50)]).length, 0);
  });

  it('recent activity scores recently_active', () => {
    const [l] = run([user('a')], [], [], [use('a', 'home', 3, 1, 3)]);
    assert.deepEqual(l.reasons, ['recently_active']);
    assert.equal(l.score, 1);
    assert.equal(l.opens30, 3);
    assert.equal(l.lastActive, '2026-11-10');
  });

  it('adds all signals up', () => {
    const [l] = run(
      [user('a')],
      pigeons('a', 3, 1),
      [],
      [use('a', 'health_assistant', 12, 5, 12)],
    );
    assert.deepEqual(l.reasons, ['at_limit', 'heavy_pro_feature', 'has_for_sale', 'recently_active']);
    assert.equal(l.score, 3 + 2 + 2 + 1);
  });

  it('excludes healthy Pro users', () => {
    assert.equal(run([user('a')], pigeons('a', 5), [sub('a')]).length, 0);
  });

  it('a cancelled Pro that still has access is churning', () => {
    const [l] = run([user('a')], [], [sub('a', { status: 'cancelled', end_date: iso(20) })]);
    assert.equal(l.plan, 'churning');
    assert.deepEqual(l.reasons, ['churn_risk']);
  });

  it('an active Pro ending within 7 days is churning', () => {
    const [l] = run([user('a')], [], [sub('a', { end_date: iso(3) })]);
    assert.equal(l.plan, 'churning');
  });

  it('a lapsed Pro is a churn_risk lead even with no activity', () => {
    const [l] = run([user('a')], [], [sub('a', { end_date: iso(-10) })]);
    assert.equal(l.plan, 'lapsed');
    assert.deepEqual(l.reasons, ['churn_risk']);
  });

  it('excludes inactive, deleted and unverified accounts', () => {
    const base = pigeons('a', 3);
    assert.equal(run([user('a', { account_status: 'inactive' })], base).length, 0);
    assert.equal(run([user('a', { account_status: 'deleted' })], base).length, 0);
    assert.equal(run([user('a', { email_confirmed_at: null })], base).length, 0);
  });

  it('sorts by score, then last activity, then name', () => {
    const users = [user('a'), user('b'), user('c'), user('d')];
    const pg = [...pigeons('a', 3), ...pigeons('b', 3), ...pigeons('c', 3), ...pigeons('d', 1, 1)];
    const usage = [
      use('a', 'home', 1, 0, 1, '2026-11-01'),
      use('b', 'home', 1, 0, 1, '2026-11-09'),
    ];
    const ids = run(users, pg, [], usage).map((l) => l.userId);
    // a,b,c score 3; d scores 2. b was active later than a; c has no activity; names break nothing here.
    assert.deepEqual(ids, ['b', 'a', 'c', 'd']);
  });

  it('respects a custom config', () => {
    const cfg = { ...LEADS_CONFIG, freePigeonLimit: 2 };
    assert.equal(run([user('a')], pigeons('a', 2), [], [], cfg).length, 1);
  });

  it('passes contact fields through', () => {
    const [l] = run([user('a', { contact_type: 'whatsapp', contact_value: '+34 600' })], pigeons('a', 3));
    assert.equal(l.contactType, 'whatsapp');
    assert.equal(l.contactValue, '+34 600');
  });
});

describe('contactLink', () => {
  it('builds a WhatsApp link from digits or keeps a URL', () => {
    assert.equal(contactLink('whatsapp', '+34 600-111 222'), 'https://wa.me/34600111222');
    assert.equal(contactLink('whatsapp', 'https://wa.me/123'), 'https://wa.me/123');
  });
  it('builds tel, mailto and instagram links', () => {
    assert.equal(contactLink('phone', '+34 600 111'), 'tel:+34600111');
    assert.equal(contactLink('email', 'a@b.com'), 'mailto:a@b.com');
    assert.equal(contactLink('instagram', '@loft_palomar'), 'https://instagram.com/loft_palomar');
    assert.equal(contactLink('instagram', 'https://instagram.com/x'), 'https://instagram.com/x');
  });
  it('returns null for unknown, empty or unsafe values', () => {
    assert.equal(contactLink('none', 'x'), null);
    assert.equal(contactLink('other', 'x'), null);
    assert.equal(contactLink(null, 'x'), null);
    assert.equal(contactLink('whatsapp', ''), null);
    assert.equal(contactLink('email', 'not-an-email'), null);
    assert.equal(contactLink('whatsapp', 'javascript:alert(1)'), null);
  });
});
