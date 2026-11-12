import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { fetchFeatureUsageByUser } from '../lib/api';
import { formatDate } from '../lib/helpers';
import { buildLeads, contactLink } from '../lib/leads';
import type { Lead } from '../lib/leads';
import type { LeadReason } from '../lib/leadsConfig';
import type { AdminDataBundle, FeatureUsageUserRow } from '../types';

const { Title, Text } = Typography;

const ALL_REASONS: LeadReason[] = [
  'at_limit',
  'churn_risk',
  'heavy_pro_feature',
  'has_for_sale',
  'recently_active',
];

interface Props {
  data: AdminDataBundle;
  loading: boolean;
}

export default function LeadsPage({ data, loading: bundleLoading }: Props) {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [usage, setUsage] = useState<FeatureUsageUserRow[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<LeadReason[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setUsageLoading(true);
    setError(false);
    try {
      setUsage(await fetchFeatureUsageByUser());
    } catch {
      setError(true);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  // Initial fetch: loading starts true, so no synchronous setState inside the effect.
  useEffect(() => {
    let cancelled = false;
    fetchFeatureUsageByUser()
      .then((r) => {
        if (!cancelled) setUsage(r);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const leads = useMemo(
    () =>
      buildLeads({
        users: data.users,
        pigeons: data.pigeons,
        subscriptions: data.subscriptions,
        usage,
        now: new Date(),
      }),
    [data, usage],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(
      (l) =>
        selected.every((r) => l.reasons.includes(r)) &&
        (!q ||
          l.displayName.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.loftName ?? '').toLowerCase().includes(q)),
    );
  }, [leads, selected, query]);

  const copy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => message.success(t('leads.copied')))
      .catch(() => message.error(text));
  };

  const toggle = (r: LeadReason, on: boolean) =>
    setSelected((cur) => (on ? [...cur, r] : cur.filter((x) => x !== r)));

  const planLabel = (l: Lead) =>
    l.plan === 'free' ? t('leads.planFree') : l.plan === 'churning' ? t('leads.planChurning') : t('leads.planLapsed');

  const columns: ColumnsType<Lead> = [
    { title: t('leads.colRank'), width: 56, render: (_: unknown, __: Lead, i: number) => i + 1 },
    {
      title: t('leads.colUser'),
      render: (_: unknown, l: Lead) => (
        <div>
          <Text strong>{l.displayName}</Text>
          {l.loftName ? <Text type="secondary"> · {l.loftName}</Text> : null}
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>{l.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: t('leads.colScore'),
      dataIndex: 'score',
      width: 90,
      align: 'right',
      render: (s: number) => <Tag color="gold">{s}</Tag>,
    },
    {
      title: t('leads.colReasons'),
      render: (_: unknown, l: Lead) => (
        <Space size={[4, 4]} wrap>
          {l.reasons.map((r) => (
            <Tag key={r}>{t(`leads.reasons.${r}`)}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('leads.colPlan'),
      render: (_: unknown, l: Lead) => <Tag color={l.plan === 'free' ? undefined : 'orange'}>{planLabel(l)}</Tag>,
    },
    {
      title: t('leads.colPigeons'),
      render: (_: unknown, l: Lead) => (
        <span>
          {l.pigeons}
          {l.forSale > 0 ? <Text type="secondary"> ({t('leads.pigeonsForSale', { count: l.forSale })})</Text> : null}
        </span>
      ),
    },
    { title: t('leads.colOpens'), dataIndex: 'opens30', align: 'right' },
    {
      title: t('leads.colLastActive'),
      render: (_: unknown, l: Lead) => (l.lastActive ? formatDate(l.lastActive) : '—'),
    },
    {
      title: t('leads.colContact'),
      render: (_: unknown, l: Lead) => {
        const link = contactLink(l.contactType, l.contactValue);
        return (
          <Space orientation="vertical" size={0}>
            <span>
              <a href={`mailto:${l.email}`}>{l.email}</a>{' '}
              <Button size="small" type="text" icon={<CopyOutlined />} aria-label={t('leads.copy')} onClick={() => copy(l.email)} />
            </span>
            {l.contactValue ? (
              <span>
                {link ? (
                  <a href={link} target="_blank" rel="noreferrer">{l.contactType}: {l.contactValue}</a>
                ) : (
                  <Text>{l.contactType}: {l.contactValue}</Text>
                )}{' '}
                <Button size="small" type="text" icon={<CopyOutlined />} aria-label={t('leads.copy')} onClick={() => copy(l.contactValue ?? '')} />
              </span>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>{t('leads.contactNone')}</Text>
            )}
          </Space>
        );
      },
    },
  ];

  const isLoading = bundleLoading || usageLoading;

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>{t('leads.title')}</Title>
        <Text type="secondary">{t('leads.subtitle')}</Text>
      </div>

      <Card style={{ borderRadius: 16 }} variant="borderless">
        <Space orientation="vertical" size="middle" style={{ width: '100%', marginBottom: 16 }}>
          <Space wrap>
            <Input.Search
              allowClear
              placeholder={t('leads.searchPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
              style={{ width: 280 }}
            />
            <Button onClick={() => void load()} loading={usageLoading}>{t('leads.refresh')}</Button>
          </Space>
          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>{t('leads.filtersLabel')}</Text>
            <Space size={[8, 8]} wrap>
              {ALL_REASONS.map((r) => (
                <Tag.CheckableTag
                  key={r}
                  checked={selected.includes(r)}
                  onChange={(on) => toggle(r, on)}
                  style={selected.includes(r) ? undefined : { border: '1px solid currentColor' }}
                >
                  {t(`leads.reasons.${r}`)}
                </Tag.CheckableTag>
              ))}
            </Space>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('leads.usageNote')}</Text>
        </Space>

        {error ? (
          <Alert type="error" showIcon message={t('leads.loadError')} />
        ) : visible.length === 0 && !isLoading ? (
          <Empty description={t('leads.empty')} />
        ) : (
          <Table<Lead>
            size="middle"
            rowKey="userId"
            loading={isLoading}
            columns={columns}
            dataSource={visible}
            pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>
    </Space>
  );
}
