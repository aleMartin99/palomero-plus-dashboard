import { useMemo } from 'react';
import { Typography, Row, Col, Card, List, Tag, Table, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import type { AdminDataBundle, Subscription } from '../types';
import {
  formatDate,
  getUserActivePremiumSub,
  grantsProAccess,
  isProPlan,
  planDisplayName,
} from '../lib/helpers';
import { buildPlatformBreakdown, platformOf } from '../lib/platformBreakdown';
import type { PlatformCounts } from '../lib/platformBreakdown';

const { Title, Text } = Typography;

interface Props {
  data: AdminDataBundle;
}

export default function SubscriptionsPage({ data }: Props) {
  const { t } = useTranslation();
  const { users, plans, subscriptions } = data;

  const validUsers = useMemo(
    () => users.filter((u) => u.account_status !== 'deleted'),
    [users],
  );

  // Same single pass the Overview uses, so the two pages can never disagree.
  const activePlanByUser = useMemo(() => {
    const map = new Map<string, string>();
    validUsers.forEach((u) => {
      const sub = getUserActivePremiumSub(subscriptions, u.id);
      if (sub) map.set(u.id, sub.plan_id);
    });
    return map;
  }, [validUsers, subscriptions]);

  const planCounts = useMemo(() => {
    const counts = new Map<string, number>();
    activePlanByUser.forEach((planId) => counts.set(planId, (counts.get(planId) || 0) + 1));
    return counts;
  }, [activePlanByUser]);

  const breakdown = useMemo(() => buildPlatformBreakdown(users, subscriptions), [users, subscriptions]);

  const platformRows: { key: string; label: string; counts: PlatformCounts; strong?: boolean }[] = [
    { key: 'monthly', label: t('subscriptions.proMonthly'), counts: breakdown.monthly },
    { key: 'annual', label: t('subscriptions.proAnnual'), counts: breakdown.annual },
    { key: 'total', label: t('subscriptions.totalPro'), counts: breakdown.total, strong: true },
  ];

  const platformColumns: ColumnsType<(typeof platformRows)[number]> = [
    {
      title: t('subscriptions.colPlan'),
      dataIndex: 'label',
      render: (v, r) => (r.strong ? <Text strong>{v}</Text> : v),
    },
    ...(['ios', 'android', 'unknown', 'total'] as const).map((k) => ({
      title: t(`subscriptions.platform_${k}`),
      align: 'right' as const,
      render: (_: unknown, r: (typeof platformRows)[number]) =>
        r.strong ? <Text strong>{r.counts[k]}</Text> : r.counts[k],
    })),
  ];

  const columns: ColumnsType<Subscription> = [
    { title: t('subscriptions.colUser'), dataIndex: 'user_email', render: (v) => <Text strong>{v}</Text> },
    {
      title: t('subscriptions.colPlan'),
      render: (_, s) => planDisplayName(plans.find((p) => p.id === s.plan_id), s.plan_id),
      filters: plans.map((p) => ({ text: p.name, value: p.id })),
      onFilter: (value, record) => record.plan_id === value,
    },
    {
      title: t('subscriptions.colStatus'),
      render: (_, s) => {
        if (!isProPlan(s.plan_id)) return <Tag>{t('subscriptions.free')}</Tag>;
        if (grantsProAccess(s)) return <Tag color="success">{t('subscriptions.proActive')}</Tag>;
        // status still says 'active' but the paid period has elapsed — the app treats this
        // user as free, so surface it as a distinct state rather than a plain "expired".
        if (s.status === 'active') return <Tag color="warning">{t('subscriptions.stale')}</Tag>;
        return <Tag color="error">{t('subscriptions.expired')}</Tag>;
      },
      filters: [
        { text: t('subscriptions.proActive'), value: 'pro_active' },
        { text: t('subscriptions.stale'), value: 'stale' },
        { text: t('subscriptions.expired'), value: 'expired' },
        { text: t('subscriptions.free'), value: 'free' },
      ],
      onFilter: (value, s) => {
        if (value === 'free') return !isProPlan(s.plan_id);
        if (!isProPlan(s.plan_id)) return false;
        if (value === 'pro_active') return grantsProAccess(s);
        if (value === 'stale') return !grantsProAccess(s) && s.status === 'active';
        return !grantsProAccess(s) && s.status !== 'active';
      },
    },
    {
      title: t('subscriptions.colPlatform'),
      render: (_, s) => {
        if (!isProPlan(s.plan_id)) return <Text type="secondary">—</Text>;
        const p = platformOf(s);
        return p === 'unknown' ? (
          <Tag>{t('subscriptions.platform_unknown')}</Tag>
        ) : (
          <Tag color={p === 'ios' ? 'geekblue' : 'green'}>{t(`subscriptions.platform_${p}`)}</Tag>
        );
      },
      filters: [
        { text: t('subscriptions.platform_ios'), value: 'ios' },
        { text: t('subscriptions.platform_android'), value: 'android' },
        { text: t('subscriptions.platform_unknown'), value: 'unknown' },
      ],
      onFilter: (value, s) => isProPlan(s.plan_id) && platformOf(s) === value,
    },
    {
      title: t('subscriptions.colUntil'),
      render: (_, s) => formatDate(s.end_date || s.expires_at),
      sorter: (a, b) =>
        (a.end_date || a.expires_at || '').localeCompare(b.end_date || b.expires_at || ''),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>
        {t('subscriptions.title')}
      </Title>
      <Text type="secondary">{t('subscriptions.subtitle')}</Text>

      <Card variant="borderless" title={t('subscriptions.platformTitle')} style={{ marginTop: 16, borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Table
          size="small"
          rowKey="key"
          columns={platformColumns}
          dataSource={platformRows}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
        <Space orientation="vertical" size={2} style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('subscriptions.platformPending', {
              pending: breakdown.pendingSync.total,
              expired: breakdown.expired.total,
            })}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('subscriptions.platformNote')}
          </Text>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card title={t('subscriptions.plans')}>
            <List
              dataSource={plans}
              renderItem={(p) => {
                  const subCount = isProPlan(p.id)
                    ? planCounts.get(p.id) || 0
                    : Math.max(0, validUsers.length - activePlanByUser.size);
                return (
                  <List.Item>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ${p.price_usd?.toString() || '0'} USD
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {p.is_active ? (
                        <Tag color="blue">{t('subscriptions.planActive')}</Tag>
                      ) : (
                        <Tag>{t('subscriptions.planInactive')}</Tag>
                      )}
                      <div>
                        <Text style={{ fontSize: 12 }}>
                          {t('subscriptions.users', { count: subCount })}
                        </Text>
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card title={t('subscriptions.recordsTitle')}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={subscriptions}
              scroll={{ x: 'max-content' }}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                showTotal: (total) => t('subscriptions.records', { count: total }),
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
