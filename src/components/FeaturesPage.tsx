import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Segmented, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { fetchFeatureUsage, fetchFeatureUsageByUser } from '../lib/api';
import { projectSummary, rankByGroup } from '../lib/featureRanking';
import type { Group, Period, RankedRow } from '../lib/featureRanking';
import { isProUser } from '../lib/helpers';
import type { AdminDataBundle, FeatureUsageRow, FeatureUsageUserRow } from '../types';

const { Title, Text } = Typography;

interface Props {
  data: AdminDataBundle;
  /** Owner only: show the All / Pro / Free selector (needs per-user data). */
  canSplitByPlan: boolean;
}

export default function FeaturesPage({ data, canSplitByPlan }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<FeatureUsageRow[]>([]);
  const [userRows, setUserRows] = useState<FeatureUsageUserRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');
  const [group, setGroup] = useState<Group>('all');

  const loadUserRows = useCallback(async () => {
    setUserLoading(true);
    setError(false);
    try {
      setUserRows(await fetchFeatureUsageByUser());
    } catch {
      setError(true);
    } finally {
      setUserLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRows(await fetchFeatureUsage());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    if (group !== 'all') await loadUserRows();
  }, [group, loadUserRows]);

  // Initial fetch: loading starts true, so no synchronous setState inside the effect.
  useEffect(() => {
    let cancelled = false;
    fetchFeatureUsage()
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onGroupChange = (g: Group) => {
    setGroup(g);
    if (g !== 'all' && userRows === null) void loadUserRows();
  };

  const proIds = useMemo(
    () => new Set(data.users.filter((u) => isProUser(data.subscriptions, u.id)).map((u) => u.id)),
    [data.users, data.subscriptions],
  );

  const ranked = useMemo<RankedRow[]>(() => {
    if (group === 'all') return projectSummary(rows, period);
    return userRows ? rankByGroup(userRows, proIds, group, period) : [];
  }, [group, rows, userRows, proIds, period]);

  const columns: ColumnsType<RankedRow> = [
    { title: t('features.colRank'), dataIndex: 'rank', width: 64 },
    {
      title: t('features.colFeature'),
      dataIndex: 'feature',
      render: (f: string) => t(`features.names.${f}`, { defaultValue: f }),
    },
    { title: t('features.colOpens'), dataIndex: 'opens', align: 'right' },
    { title: t('features.colUsers'), dataIndex: 'users', align: 'right' },
    {
      title: t('features.colShare'),
      dataIndex: 'share',
      align: 'right',
      render: (s: number) => `${Math.round(s * 100)}%`,
    },
    {
      title: t('features.colPerUser'),
      dataIndex: 'perUser',
      align: 'right',
      render: (n: number) => n.toFixed(1),
    },
  ];

  const isLoading = loading || (group !== 'all' && userLoading);

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>{t('features.title')}</Title>
        <Text type="secondary">{t('features.subtitle')}</Text>
      </div>

      <Card style={{ borderRadius: 16 }} variant="borderless">
        <Space style={{ marginBottom: 16 }} wrap>
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { label: t('features.period7'), value: '7d' },
              { label: t('features.period30'), value: '30d' },
              { label: t('features.periodAll'), value: 'all' },
            ]}
          />
          {canSplitByPlan ? (
            <Segmented<Group>
              value={group}
              onChange={onGroupChange}
              options={[
                { label: t('features.groupAll'), value: 'all' },
                { label: t('features.groupPro'), value: 'pro' },
                { label: t('features.groupFree'), value: 'free' },
              ]}
            />
          ) : null}
          <Button onClick={() => void load()} loading={isLoading}>{t('features.refresh')}</Button>
        </Space>

        {error ? (
          <Alert type="error" showIcon message={t('features.loadError')} />
        ) : ranked.length === 0 && !isLoading ? (
          <Empty description={t('features.empty')} />
        ) : (
          <Table<RankedRow>
            size="middle"
            rowKey="key"
            loading={isLoading}
            columns={columns}
            dataSource={ranked}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>
    </Space>
  );
}
