import { useState } from 'react';
import {
  Table,
  Avatar,
  Tag,
  Button,
  Drawer,
  Typography,
  Descriptions,
  List,
  Popconfirm,
  Space,
  App,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckOutlined, StopOutlined, CheckCircleFilled, SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AdminDataBundle, AdminUser } from '../types';
import { banUser, unbanUser } from '../lib/api';
import {
  formatDate,
  getUserActivePremiumSub,
  initialOf,
  isProPlan,
  isVerified,
  planDisplayName,
} from '../lib/helpers';
import { appColors } from '../theme/tokens';

const { Title, Text } = Typography;

interface Props {
  data: AdminDataBundle;
  onChanged: () => void;
  /** Owner-only. The Edge Function enforces this too — hiding the button is just UX. */
  canBan: boolean;
}

export default function UsersPage({ data, onChanged, canBan }: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function statusTag(status: string) {
    if (status === 'active') return <Tag color="success">{t('users.statusActive')}</Tag>;
    if (status === 'inactive') return <Tag color="warning">{t('users.statusBanned')}</Tag>;
    return <Tag color="error">{t('users.statusDeleted')}</Tag>;
  }

  async function handleBan(userId: string) {
    setActionLoading(userId);
    try {
      await banUser(userId);
      message.success(t('users.banned'));
      onChanged();
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('users.banFailed'));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnban(userId: string) {
    setActionLoading(userId);
    try {
      await unbanUser(userId);
      message.success(t('users.reactivated'));
      onChanged();
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('users.reactivateFailed'));
    } finally {
      setActionLoading(null);
    }
  }

  const columns: ColumnsType<AdminUser> = [
    {
      title: t('users.colUser'),
      dataIndex: 'display_name',
      render: (_, u) => (
        <Space onClick={() => setSelected(u)} style={{ cursor: 'pointer' }}>
          <Avatar style={{ background: appColors.secondary }}>{initialOf(u.display_name)}</Avatar>
          <div>
            <div style={{ fontWeight: 600 }}>{u.display_name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {u.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: t('users.colStatus'),
      dataIndex: 'account_status',
      render: statusTag,
      filters: [
        { text: t('users.statusActive'), value: 'active' },
        { text: t('users.statusBanned'), value: 'inactive' },
        { text: t('users.statusDeleted'), value: 'deleted' },
      ],
      onFilter: (value, record) => record.account_status === value,
    },
    {
      title: t('users.colVerification'),
      render: (_, u) =>
        isVerified(u) ? (
          <Tag icon={<CheckCircleFilled />} color="success">
            {t('users.verified')}
          </Tag>
        ) : (
          <Tag icon={<SyncOutlined spin />} color="default">
            {t('users.pending')}
          </Tag>
        ),
    },
    {
      title: t('users.colJoined'),
      dataIndex: 'created_at',
      render: formatDate,
      sorter: (a, b) => (a.created_at || '').localeCompare(b.created_at || ''),
    },
  ];

  if (canBan) {
    columns.push({
      title: t('users.colActions'),
      align: 'right',
      render: (_, u) =>
        u.account_status === 'active' ? (
          <Popconfirm title={t('users.banConfirm')} onConfirm={() => handleBan(u.id)}>
            <Button danger size="small" icon={<StopOutlined />} loading={actionLoading === u.id}>
              {t('users.ban')}
            </Button>
          </Popconfirm>
        ) : u.account_status === 'inactive' ? (
          <Button
            size="small"
            icon={<CheckOutlined />}
            loading={actionLoading === u.id}
            onClick={() => handleUnban(u.id)}
          >
            {t('users.activate')}
          </Button>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('users.deletedAccount')}
          </Text>
        ),
    });
  }

  const selectedPigeons = selected ? data.pigeons.filter((p) => p.user_id === selected.id) : [];
  const selectedCaptures = selected ? data.captures.filter((c) => c.user_id === selected.id) : [];
  const activeSub = selected ? getUserActivePremiumSub(data.subscriptions, selected.id) : undefined;
  const selectedSub =
    activeSub ||
    (selected
      ? data.subscriptions.find((s) => s.user_id === selected.id && isProPlan(s.plan_id))
      : undefined);
  const selectedPlan = selectedSub ? data.plans.find((p) => p.id === selectedSub.plan_id) : undefined;

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>
        {t('users.title')}
      </Title>
      <Text type="secondary">{t('users.subtitle')}</Text>

      <Table
        style={{ marginTop: 16 }}
        rowKey="id"
        columns={columns}
        dataSource={data.users}
        pagination={{ pageSize: 10, showSizeChanger: false }}
      />

      <Drawer
        title={selected?.display_name}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width={480}
      >
        {selected && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label={t('users.drawerEmail')}>{selected.email}</Descriptions.Item>
              <Descriptions.Item label={t('users.drawerUsername')}>
                @{selected.username || 'fancier'}
              </Descriptions.Item>
              <Descriptions.Item label={t('users.drawerStatus')}>
                {statusTag(selected.account_status)}
              </Descriptions.Item>
              <Descriptions.Item label={t('users.drawerPlan')}>
                {selectedSub ? (
                  <>
                    {planDisplayName(selectedPlan, selectedSub.plan_id)}{' '}
                    {activeSub ? (
                      <Tag color="success">{t('users.planActive')}</Tag>
                    ) : (
                      <Tag color="warning">{t('users.planLapsed')}</Tag>
                    )}
                    {(selectedSub.end_date || selectedSub.expires_at) && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {activeSub ? t('users.renewsExpires') : t('users.ended')}{' '}
                          {formatDate(selectedSub.end_date || selectedSub.expires_at)}
                        </Text>
                      </div>
                    )}
                  </>
                ) : (
                  t('users.planFree')
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t('users.drawerJoined')}>
                {formatDate(selected.created_at)}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 24 }}>
              {t('users.pigeonsTitle', { count: selectedPigeons.length })}
            </Title>
            <List
              size="small"
              bordered
              dataSource={selectedPigeons}
              locale={{ emptyText: t('users.noPigeons') }}
              renderItem={(p) => (
                <List.Item>
                  <Text strong>{p.name || t('users.unnamedPigeon')}</Text>
                  <Text type="secondary">
                    {p.ring_number || t('users.noRing')} ({p.sex || 'U'})
                  </Text>
                </List.Item>
              )}
            />

            <Title level={5} style={{ marginTop: 24 }}>
              {t('users.capturesTitle', { count: selectedCaptures.length })}
            </Title>
            <List
              size="small"
              bordered
              dataSource={selectedCaptures}
              locale={{ emptyText: t('users.noCaptures') }}
              renderItem={(c) => {
                const pigeon = data.pigeons.find((p) => p.id === c.pigeon_id);
                return (
                  <List.Item>
                    <span>
                      {t('users.captured')}{' '}
                      <Text strong>{pigeon ? pigeon.name : t('users.unknownPigeon')}</Text>
                    </span>
                    <Text type="secondary">
                      {c.captured_at
                        ? c.captured_at.substring(0, 16).replace('T', ' ')
                        : t('users.unknownDate')}
                    </Text>
                  </List.Item>
                );
              }}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
