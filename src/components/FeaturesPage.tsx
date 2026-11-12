import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Segmented, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { fetchFeatureUsage } from '../lib/api';
import type { FeatureUsageRow } from '../types';

const { Title, Text } = Typography;

type Period = '7d' | '30d' | 'all';

interface RankedRow {
  key: string;
  rank: number;
  feature: string;
  opens: number;
  users: number;
  share: number; // 0..1 of active users in the period
}

function project(rows: FeatureUsageRow[], period: Period): RankedRow[] {
  return rows
    .map((r) => {
      const opens = period === '7d' ? r.opens_7d : period === '30d' ? r.opens_30d : r.opens_all;
      const users = period === '7d' ? r.users_7d : period === '30d' ? r.users_30d : r.users_all;
      const total =
        period === '7d' ? r.total_users_7d : period === '30d' ? r.total_users_30d : r.total_users_all;
      return { feature: r.feature, opens, users, share: total > 0 ? users / total : 0 };
    })
    .filter((r) => r.opens > 0)
    .sort((a, b) => b.opens - a.opens || b.users - a.users || a.feature.localeCompare(b.feature))
    .map((r, i) => ({ ...r, key: r.feature, rank: i + 1 }));
}

export default function FeaturesPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<FeatureUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');

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
  }, []);

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

  const ranked = useMemo(() => project(rows, period), [rows, period]);

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
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>{t('features.title')}</Title>
        <Text type="secondary">{t('features.subtitle')}</Text>
      </div>

      <Card style={{ borderRadius: 16 }} bordered={false}>
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
          <Button onClick={() => void load()} loading={loading}>{t('features.refresh')}</Button>
        </Space>

        {error ? (
          <Alert type="error" showIcon message={t('features.loadError')} />
        ) : ranked.length === 0 && !loading ? (
          <Empty description={t('features.empty')} />
        ) : (
          <Table<RankedRow>
            size="middle"
            rowKey="key"
            loading={loading}
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
