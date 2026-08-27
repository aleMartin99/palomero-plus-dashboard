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

const { Title, Text } = Typography;

interface Props {
  data: AdminDataBundle;
  onChanged: () => void;
  /** Owner-only. The Edge Function enforces this too — hiding the button is just UX. */
  canBan: boolean;
}

function statusTag(status: string) {
  if (status === 'active') return <Tag color="success">Active</Tag>;
  if (status === 'inactive') return <Tag color="warning">Banned</Tag>;
  return <Tag color="error">Deleted</Tag>;
}

export default function UsersPage({ data, onChanged, canBan }: Props) {
  const { message } = App.useApp();
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleBan(userId: string) {
    setActionLoading(userId);
    try {
      await banUser(userId);
      message.success('User banned.');
      onChanged();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to ban user.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnban(userId: string) {
    setActionLoading(userId);
    try {
      await unbanUser(userId);
      message.success('User reactivated.');
      onChanged();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to reactivate user.');
    } finally {
      setActionLoading(null);
    }
  }

  const columns: ColumnsType<AdminUser> = [
    {
      title: 'Fancier',
      dataIndex: 'display_name',
      render: (_, u) => (
        <Space onClick={() => setSelected(u)} style={{ cursor: 'pointer' }}>
          <Avatar>{initialOf(u.display_name)}</Avatar>
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
      title: 'Status',
      dataIndex: 'account_status',
      render: statusTag,
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Banned', value: 'inactive' },
        { text: 'Deleted', value: 'deleted' },
      ],
      onFilter: (value, record) => record.account_status === value,
    },
    {
      title: 'Verification',
      render: (_, u) =>
        isVerified(u) ? (
          <Tag icon={<CheckCircleFilled />} color="success">
            Verified
          </Tag>
        ) : (
          <Tag icon={<SyncOutlined spin />} color="default">
            Pending
          </Tag>
        ),
    },
    {
      title: 'Joined Date',
      dataIndex: 'created_at',
      render: formatDate,
      sorter: (a, b) => (a.created_at || '').localeCompare(b.created_at || ''),
    },
  ];

  if (canBan) {
    columns.push({
      title: 'Actions',
      align: 'right',
      render: (_, u) =>
        u.account_status === 'active' ? (
          <Popconfirm title="Ban this user?" onConfirm={() => handleBan(u.id)}>
            <Button danger size="small" icon={<StopOutlined />} loading={actionLoading === u.id}>
              Ban
            </Button>
          </Popconfirm>
        ) : u.account_status === 'inactive' ? (
          <Button
            size="small"
            icon={<CheckOutlined />}
            loading={actionLoading === u.id}
            onClick={() => handleUnban(u.id)}
          >
            Activate
          </Button>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Deleted account
          </Text>
        ),
    });
  }

  const selectedPigeons = selected ? data.pigeons.filter((p) => p.user_id === selected.id) : [];
  const selectedCaptures = selected ? data.captures.filter((c) => c.user_id === selected.id) : [];
  // Prefer the sub currently granting Pro; otherwise fall back to any past Pro sub so the
  // drawer can show "lapsed" rather than silently reading as a plain free account.
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
        User Management
      </Title>
      <Text type="secondary">View and moderate registered fancier profiles and verification status.</Text>

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
              <Descriptions.Item label="Email">{selected.email}</Descriptions.Item>
              <Descriptions.Item label="Username">@{selected.username || 'fancier'}</Descriptions.Item>
              <Descriptions.Item label="Status">{statusTag(selected.account_status)}</Descriptions.Item>
              <Descriptions.Item label="Plan">
                {selectedSub ? (
                  <>
                    {planDisplayName(selectedPlan, selectedSub.plan_id)}{' '}
                    {activeSub ? <Tag color="success">Active</Tag> : <Tag color="warning">Lapsed</Tag>}
                    {(selectedSub.end_date || selectedSub.expires_at) && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {activeSub ? 'Renews/expires' : 'Ended'}{' '}
                          {formatDate(selectedSub.end_date || selectedSub.expires_at)}
                        </Text>
                      </div>
                    )}
                  </>
                ) : (
                  'Free'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Joined">{formatDate(selected.created_at)}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 24 }}>
              Registered Pigeons ({selectedPigeons.length})
            </Title>
            <List
              size="small"
              bordered
              dataSource={selectedPigeons}
              locale={{ emptyText: 'No pigeons registered' }}
              renderItem={(p) => (
                <List.Item>
                  <Text strong>{p.name || 'Unnamed Pigeon'}</Text>
                  <Text type="secondary">
                    {p.ring_number || 'No Ring'} ({p.sex || 'U'})
                  </Text>
                </List.Item>
              )}
            />

            <Title level={5} style={{ marginTop: 24 }}>
              Recent Captures ({selectedCaptures.length})
            </Title>
            <List
              size="small"
              bordered
              dataSource={selectedCaptures}
              locale={{ emptyText: 'No captures recorded' }}
              renderItem={(c) => {
                const pigeon = data.pigeons.find((p) => p.id === c.pigeon_id);
                return (
                  <List.Item>
                    <span>
                      Captured <Text strong>{pigeon ? pigeon.name : 'Unknown Pigeon'}</Text>
                    </span>
                    <Text type="secondary">{c.captured_at ? c.captured_at.substring(0, 16).replace('T', ' ') : 'Unknown Date'}</Text>
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
