import { useMemo } from 'react';
import { Typography, Row, Col, Card, List, Tag, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { AdminDataBundle, Subscription } from '../types';
import {
  formatDate,
  getUserActivePremiumSub,
  grantsProAccess,
  isProPlan,
  planDisplayName,
} from '../lib/helpers';

const { Title, Text } = Typography;

interface Props {
  data: AdminDataBundle;
}

export default function SubscriptionsPage({ data }: Props) {
  const { users, plans, subscriptions } = data;

  // Same single pass the Overview uses, so the two pages can never disagree.
  const activePlanByUser = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      const sub = getUserActivePremiumSub(subscriptions, u.id);
      if (sub) map.set(u.id, sub.plan_id);
    });
    return map;
  }, [users, subscriptions]);

  const planCounts = useMemo(() => {
    const counts = new Map<string, number>();
    activePlanByUser.forEach((planId) => counts.set(planId, (counts.get(planId) || 0) + 1));
    return counts;
  }, [activePlanByUser]);

  const columns: ColumnsType<Subscription> = [
    { title: 'User', dataIndex: 'user_email', render: (v) => <Text strong>{v}</Text> },
    {
      title: 'Plan Type',
      render: (_, s) => planDisplayName(plans.find((p) => p.id === s.plan_id), s.plan_id),
      filters: plans.map((p) => ({ text: p.name, value: p.id })),
      onFilter: (value, record) => record.plan_id === value,
    },
    {
      title: 'Status',
      render: (_, s) => {
        if (!isProPlan(s.plan_id)) return <Tag>Free</Tag>;
        if (grantsProAccess(s)) return <Tag color="success">Pro active</Tag>;
        // status still says 'active' but the paid period has elapsed — the app treats this
        // user as free, so surface it as a distinct state rather than a plain "expired".
        if (s.status === 'active') return <Tag color="warning">Lapsed (stale status)</Tag>;
        return <Tag color="error">Expired</Tag>;
      },
      filters: [
        { text: 'Pro active', value: 'pro_active' },
        { text: 'Lapsed (stale status)', value: 'stale' },
        { text: 'Expired', value: 'expired' },
        { text: 'Free', value: 'free' },
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
      title: 'Active Until',
      render: (_, s) => formatDate(s.end_date || s.expires_at),
      sorter: (a, b) =>
        (a.end_date || a.expires_at || '').localeCompare(b.end_date || b.expires_at || ''),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>
        Subscription Management
      </Title>
      <Text type="secondary">Audit system plans, pricing, and active subscriptions.</Text>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card title="Available Plans">
            <List
              dataSource={plans}
              renderItem={(p) => {
                const subCount = isProPlan(p.id)
                  ? planCounts.get(p.id) || 0
                  : Math.max(0, users.length - activePlanByUser.size);
                return (
                  <List.Item>
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ${p.price_usd?.toString() || '0'} USD
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {p.is_active ? <Tag color="blue">Active</Tag> : <Tag>Inactive</Tag>}
                      <div>
                        <Text style={{ fontSize: 12 }}>
                          {subCount} user{subCount !== 1 ? 's' : ''}
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
          <Card title="Subscription Records">
            <Table
              rowKey="id"
              columns={columns}
              dataSource={subscriptions}
              pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (t) => `${t} records` }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
