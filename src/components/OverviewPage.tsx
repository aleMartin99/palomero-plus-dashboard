import { useMemo } from 'react';
import { Row, Col, Card, Statistic, Button, Typography } from 'antd';
import {
  UserOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import type { AdminDataBundle } from '../types';
import { getUserActivePremiumSub, hasLapsedProSub, isProPlan, isVerified } from '../lib/helpers';

const { Title, Text } = Typography;

interface Props {
  data: AdminDataBundle;
  loading: boolean;
  onRefresh: () => void;
}

export default function OverviewPage({ data, loading, onRefresh }: Props) {
  const { users, pigeons, captures, subscriptions, plans } = data;

  const verifiedPercent = users.length
    ? Math.round((users.filter(isVerified).length / users.length) * 100)
    : 0;
  const avgPigeons = users.length ? (pigeons.length / users.length).toFixed(1) : '0';

  // One pass: the plan each user is currently Pro on (undefined = free / lapsed).
  const activePlanByUser = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      const sub = getUserActivePremiumSub(subscriptions, u.id);
      if (sub) map.set(u.id, sub.plan_id);
    });
    return map;
  }, [users, subscriptions]);

  const activeSubs = activePlanByUser.size;
  const lapsedSubs = users.filter((u) => hasLapsedProSub(subscriptions, u.id)).length;

  const registrationSeries = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach((u) => {
      if (!u.created_at) return;
      const day = u.created_at.substring(0, 10);
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [users]);

  // Tier breakdown is derived from the real subscription_plans table rather than hardcoded
  // tier names, so adding or renaming a plan in the DB flows through automatically.
  const tierSeries = useMemo(() => {
    const counts = new Map<string, number>();
    activePlanByUser.forEach((planId) => counts.set(planId, (counts.get(planId) || 0) + 1));

    const perPlan = plans
      .filter((p) => isProPlan(p.id))
      .map((p) => ({ type: p.name, value: counts.get(p.id) || 0 }));

    // Everyone not currently on a Pro plan is Free — matches `isFree` in the app.
    const freeCount = Math.max(0, users.length - activeSubs);
    return [{ type: 'Free', value: freeCount }, ...perPlan].map((t) => ({
      ...t,
      type: `${t.type} (${t.value})`,
    }));
  }, [users.length, plans, activePlanByUser, activeSubs]);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            System Performance
          </Title>
          <Text type="secondary">Live indicators across registration, pigeons, and system health.</Text>
        </Col>
        <Col>
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
            Refresh stats
          </Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={users.length}
              prefix={<UserOutlined />}
              suffix={<Text type="success" style={{ fontSize: 12 }}>{`${verifiedPercent}% verified`}</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Registered Pigeons"
              value={pigeons.length}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>{`${avgPigeons} / user`}</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Total Captures" value={captures.length} prefix={<EnvironmentOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pro Subscribers"
              value={activeSubs}
              prefix={<CrownOutlined />}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>{`${lapsedSubs} lapsed`}</Text>}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="User Registrations & Growth">
            <div style={{ height: 260 }}>
              <Line
                data={registrationSeries}
                xField="date"
                yField="count"
                height={260}
                point={{ size: 3 }}
                smooth
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Subscription Tier Breakdown">
            <div style={{ height: 260 }}>
              <Pie
                data={tierSeries}
                angleField="value"
                colorField="type"
                height={260}
                label={{ text: 'value', style: { fontWeight: 'bold' } }}
                legend={{ color: { position: 'bottom' } }}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
