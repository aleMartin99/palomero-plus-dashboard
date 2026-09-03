import { useMemo } from 'react';
import { Row, Col, Card, Statistic, Button, Typography, Tooltip } from 'antd';
import {
  UserOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AdminDataBundle } from '../types';
import { hasLapsedProSub, isProUser, isVerified } from '../lib/helpers';
import SignupsChart from './SignupsChart';
import PlanMixChart from './PlanMixChart';

const { Title, Text } = Typography;

interface Props {
  data: AdminDataBundle;
  loading: boolean;
  onRefresh: () => void;
}

export default function OverviewPage({ data, loading, onRefresh }: Props) {
  const { t } = useTranslation();
  const { users, pigeons, captures, subscriptions } = data;

  const verifiedPercent = users.length
    ? Math.round((users.filter(isVerified).length / users.length) * 100)
    : 0;
  const avgPigeons = users.length ? (pigeons.length / users.length).toFixed(1) : '0';

  const proCount = useMemo(
    () => users.filter((u) => isProUser(subscriptions, u.id)).length,
    [users, subscriptions],
  );
  const lapsedCount = useMemo(
    () => users.filter((u) => hasLapsedProSub(subscriptions, u.id)).length,
    [users, subscriptions],
  );

  return (
    <div>
      <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm="auto">
          <Title level={3} style={{ margin: 0 }}>
            {t('overview.title')}
          </Title>
          <Text type="secondary">{t('overview.subtitle')}</Text>
        </Col>
        <Col xs={24} sm="auto">
          <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
            {t('overview.refresh')}
          </Button>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('overview.totalUsers')}
              value={users.length}
              prefix={<UserOutlined />}
              suffix={
                <Text type="success" style={{ fontSize: 12 }}>
                  {t('overview.verified', { percent: verifiedPercent })}
                </Text>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('overview.pigeons')}
              value={pigeons.length}
              suffix={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('overview.perUser', { value: avgPigeons })}
                </Text>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('overview.captures')}
              value={captures.length}
              prefix={<EnvironmentOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('overview.proSubscribers')}
              value={proCount}
              prefix={<CrownOutlined />}
              suffix={
                <Tooltip title={t('overview.lapsedHint')}>
                  <Text type="secondary" style={{ fontSize: 12, cursor: 'help' }}>
                    {t('overview.lapsed', { count: lapsedCount })}
                  </Text>
                </Tooltip>
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <SignupsChart users={users} />
        </Col>
        <Col xs={24} lg={10}>
          <PlanMixChart data={data} />
        </Col>
      </Row>
    </div>
  );
}
