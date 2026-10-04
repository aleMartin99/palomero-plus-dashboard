import { useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Input,
  Segmented,
  Table,
  Tag,
  Avatar,
  Space,
  Dropdown,
  Button,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  TrophyOutlined,
  CrownOutlined,
  HourglassOutlined,
  DownloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AdminDataBundle, AdminUser, Subscription } from '../types';
import {
  hasLapsedProSub,
  getUserActivePremiumSub,
  formatDate,
} from '../lib/helpers';
import { exportGiveawayPdf, type GiveawayParticipant } from '../lib/exportPdf';

const { Title, Text } = Typography;

interface Props {
  data: AdminDataBundle;
  loading?: boolean;
}

type FilterKey = 'all' | 'active' | 'lapsed';

interface ProcessedParticipant {
  id: string;
  user: AdminUser;
  subscription?: Subscription;
  isLapsed: boolean;
  name: string;
  username: string;
  loftName: string;
  planName: string;
  expiresFormatted: string;
}

export default function GiveawaysPage({ data, loading }: Props) {
  const { t } = useTranslation();
  const { users, subscriptions } = data;

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  // 1. Process users who qualify for Giveaway (active Pro or lapsed Pro)
  const { activeUsers, lapsedUsers, allUsers } = useMemo(() => {
    const active: ProcessedParticipant[] = [];
    const lapsed: ProcessedParticipant[] = [];

    // Filter out permanently deleted accounts
    const validUsers = users.filter((u) => u.account_status !== 'deleted');

    for (const u of validUsers) {
      const activeSub = getUserActivePremiumSub(subscriptions, u.id);
      if (activeSub) {
        const isAnnual = activeSub.plan_id.includes('annual') || activeSub.plan_id.includes('yearly');
        active.push({
          id: u.id,
          user: u,
          subscription: activeSub,
          isLapsed: false,
          name: (u.display_name || u.username || 'Fancier').trim(),
          username: u.username,
          loftName: u.loft_name || '',
          planName: isAnnual ? t('giveaways.planAnnual') : t('giveaways.planMonthly'),
          expiresFormatted: formatDate(activeSub.end_date || activeSub.expires_at),
        });
      } else if (hasLapsedProSub(subscriptions, u.id)) {
        // Find their most recent Pro subscription
        const userSubs = subscriptions.filter(
          (s) => s.user_id === u.id && (s.plan_id.includes('pro') || s.plan_id.includes('premium')),
        );
        const latestSub = userSubs[0];
        const isAnnual = latestSub?.plan_id.includes('annual') || latestSub?.plan_id.includes('yearly');
        lapsed.push({
          id: u.id,
          user: u,
          subscription: latestSub,
          isLapsed: true,
          name: (u.display_name || u.username || 'Fancier').trim(),
          username: u.username,
          loftName: u.loft_name || '',
          planName: isAnnual ? t('giveaways.planAnnual') : t('giveaways.planMonthly'),
          expiresFormatted: latestSub ? formatDate(latestSub.end_date || latestSub.expires_at) : '--',
        });
      }
    }

    // Sort alphabetically by name
    const sortFn = (a: ProcessedParticipant, b: ProcessedParticipant) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

    active.sort(sortFn);
    lapsed.sort(sortFn);

    const all = [...active, ...lapsed].sort(sortFn);

    return { activeUsers: active, lapsedUsers: lapsed, allUsers: all };
  }, [users, subscriptions, t]);

  // 2. Filtered and searched data for the UI table
  const displayedList = useMemo(() => {
    let source: ProcessedParticipant[];
    if (filter === 'active') source = activeUsers;
    else if (filter === 'lapsed') source = lapsedUsers;
    else source = allUsers;

    if (!search.trim()) return source;

    const query = search.toLowerCase().trim();
    return source.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.username.toLowerCase().includes(query) ||
        item.loftName.toLowerCase().includes(query),
    );
  }, [filter, search, activeUsers, lapsedUsers, allUsers]);

  // 3. Export PDF Handler
  const handleExport = (targetGroup: FilterKey) => {
    let targetParticipants: ProcessedParticipant[];
    let filterLabel: string;
    let fileNameSlug: string;

    if (targetGroup === 'active') {
      targetParticipants = activeUsers;
      filterLabel = t('giveaways.pdfFilterActive');
      fileNameSlug = 'solo_activos';
    } else if (targetGroup === 'lapsed') {
      targetParticipants = lapsedUsers;
      filterLabel = t('giveaways.pdfFilterLapsed');
      fileNameSlug = 'solo_por_sincronizar';
    } else {
      targetParticipants = allUsers;
      filterLabel = t('giveaways.pdfFilterAll');
      fileNameSlug = 'todos_participantes';
    }

    const participantsData: GiveawayParticipant[] = targetParticipants.map((item, idx) => ({
      number: idx + 1,
      name: item.name,
      username: item.username,
      loftName: item.loftName || '—',
      plan: item.planName,
      status: item.isLapsed ? t('giveaways.tagLapsed') : t('giveaways.tagActive'),
      expires: item.expiresFormatted,
    }));

    exportGiveawayPdf({
      title: t('giveaways.pdfTitle'),
      filterLabel,
      totalLabel: t('giveaways.pdfTotalParticipants'),
      generatedAtLabel: t('giveaways.pdfGeneratedAt'),
      participants: participantsData,
      fileName: `sorteos_pro_${fileNameSlug}_${new Date().toISOString().slice(0, 10)}.pdf`,
      headers: {
        number: t('giveaways.colNumber'),
        name: t('giveaways.colName'),
        username: t('giveaways.colUser'),
        loft: t('giveaways.colLoft'),
        plan: t('giveaways.colPlan'),
        status: t('giveaways.colStatus'),
        expires: t('giveaways.colExpires'),
      },
    });
  };

  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'all',
      label: t('giveaways.downloadAll', { count: allUsers.length }),
      icon: <DownloadOutlined />,
      onClick: () => handleExport('all'),
    },
    {
      key: 'active',
      label: t('giveaways.downloadActive', { count: activeUsers.length }),
      icon: <CrownOutlined style={{ color: '#059669' }} />,
      onClick: () => handleExport('active'),
    },
    {
      key: 'lapsed',
      label: t('giveaways.downloadLapsed', { count: lapsedUsers.length }),
      icon: <HourglassOutlined style={{ color: '#D97706' }} />,
      onClick: () => handleExport('lapsed'),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <Title level={3} style={{ margin: 0 }}>
          {t('giveaways.title')}
        </Title>
        <Text type="secondary">{t('giveaways.subtitle')}</Text>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card hoverable style={{ borderTop: '3px solid #D97706' }}>
            <Statistic
              title={t('giveaways.totalEligible')}
              value={allUsers.length}
              prefix={<TrophyOutlined style={{ color: '#D97706', marginRight: 8 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card hoverable style={{ borderTop: '3px solid #059669' }}>
            <Statistic
              title={t('giveaways.activeSubs')}
              value={activeUsers.length}
              prefix={<CrownOutlined style={{ color: '#059669', marginRight: 8 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card hoverable style={{ borderTop: '3px solid #EF4444' }}>
            <Statistic
              title={t('giveaways.lapsedSubs')}
              value={lapsedUsers.length}
              prefix={<HourglassOutlined style={{ color: '#EF4444', marginRight: 8 }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter and Actions Bar */}
      <Card styles={{ body: { padding: 16 } }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={14}>
            <Space orientation="horizontal" size="middle" wrap>
              <Segmented<FilterKey>
                value={filter}
                onChange={setFilter}
                options={[
                  {
                    value: 'all',
                    label: t('giveaways.allTab', { count: allUsers.length }),
                  },
                  {
                    value: 'active',
                    label: (
                      <span>
                        <CrownOutlined style={{ color: '#059669', marginRight: 4 }} />
                        {t('giveaways.activeTab', { count: activeUsers.length })}
                      </span>
                    ),
                  },
                  {
                    value: 'lapsed',
                    label: (
                      <span>
                        <HourglassOutlined style={{ color: '#EF4444', marginRight: 4 }} />
                        {t('giveaways.lapsedTab', { count: lapsedUsers.length })}
                      </span>
                    ),
                  },
                ]}
              />

              <Input
                placeholder={t('giveaways.searchPlaceholder')}
                prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{ width: 240 }}
              />
            </Space>
          </Col>

          <Col xs={24} md={10} style={{ textAlign: 'right' }}>
            <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
              <Button type="primary" icon={<DownloadOutlined />}>
                {t('giveaways.downloadPdf')}
              </Button>
            </Dropdown>
          </Col>
        </Row>
      </Card>

      {/* Participants Table */}
      <Card styles={{ body: { padding: 0 } }}>
        <Table<ProcessedParticipant>
          dataSource={displayedList}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} de ${total}`,
          }}
          locale={{ emptyText: t('giveaways.empty') }}
          columns={[
            {
              title: t('giveaways.colNumber'),
              key: 'index',
              width: 60,
              align: 'center',
              render: (_val, _record, index) => (
                <Text strong style={{ color: '#6B7280' }}>
                  {index + 1}
                </Text>
              ),
            },
            {
              title: t('giveaways.colName'),
              key: 'name',
              render: (_val, record) => (
                <Space>
                  <Avatar
                    size="small"
                    icon={<UserOutlined />}
                    style={{ backgroundColor: record.isLapsed ? '#9CA3AF' : '#B71C1C' }}
                  />
                  <Text strong>{record.name}</Text>
                </Space>
              ),
            },
            {
              title: t('giveaways.colUser'),
              dataIndex: 'username',
              key: 'username',
              render: (username: string) => <Text code>@{username}</Text>,
            },
            {
              title: t('giveaways.colLoft'),
              dataIndex: 'loftName',
              key: 'loftName',
              render: (loftName: string) => loftName ? <Text>{loftName}</Text> : <Text type="secondary">—</Text>,
            },
            {
              title: t('giveaways.colPlan'),
              dataIndex: 'planName',
              key: 'planName',
              render: (planName: string) => (
                <Tag color={planName === t('giveaways.planAnnual') ? 'purple' : 'blue'}>
                  {planName}
                </Tag>
              ),
            },
            {
              title: t('giveaways.colStatus'),
              key: 'status',
              render: (_val, record) =>
                record.isLapsed ? (
                  <Tag color="warning" icon={<HourglassOutlined />}>
                    {t('giveaways.tagLapsed')}
                  </Tag>
                ) : (
                  <Tag color="success" icon={<CrownOutlined />}>
                    {t('giveaways.tagActive')}
                  </Tag>
                ),
            },
            {
              title: t('giveaways.colExpires'),
              dataIndex: 'expiresFormatted',
              key: 'expiresFormatted',
              render: (expires: string) => <Text type="secondary">{expires}</Text>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
