import { useEffect, useState } from 'react';
import { Layout, Menu, Badge, Space, Typography, Dropdown, Avatar, Tag, Spin, Button } from 'antd';
import {
  PieChartOutlined,
  TeamOutlined,
  MailOutlined,
  CreditCardOutlined,
  LogoutOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import OverviewPage from './components/OverviewPage';
import UsersPage from './components/UsersPage';
import ContactsPage from './components/ContactsPage';
import SubscriptionsPage from './components/SubscriptionsPage';
import LoginPage from './components/LoginPage';
import { useAdminData } from './hooks/useAdminData';
import { useAuth } from './lib/auth';
import { ROLE_LABELS, type TabKey } from './lib/roles';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const ALL_MENU_ITEMS: { key: TabKey; icon: React.ReactNode; label: string }[] = [
  { key: 'overview', icon: <PieChartOutlined />, label: 'Overview' },
  { key: 'users', icon: <TeamOutlined />, label: 'Users' },
  { key: 'contacts', icon: <MailOutlined />, label: 'Contact Requests' },
  { key: 'subscriptions', icon: <CreditCardOutlined />, label: 'Subscriptions' },
];

const connectionMeta = {
  unconfigured: { status: 'default' as const, text: 'Not configured' },
  connected: { status: 'success' as const, text: 'Connected' },
  error: { status: 'warning' as const, text: 'Connection failed — showing demo data' },
};

export default function App() {
  const { session, email, role, permissions, loading: authLoading, signOut } = useAuth();
  const [tab, setTab] = useState<TabKey>('overview');
  const { data, loading, connection, refresh } = useAdminData(Boolean(role));

  const allowedTabs = permissions.tabs;
  const menuItems = ALL_MENU_ITEMS.filter((i) => allowedTabs.includes(i.key));

  // If the role ever changes to one that can't see the open tab, fall back to the first
  // tab they can see rather than rendering a page they aren't allowed to look at.
  useEffect(() => {
    if (allowedTabs.length && !allowedTabs.includes(tab)) {
      setTab(allowedTabs[0]);
    }
  }, [allowedTabs, tab]);

  if (authLoading) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </Layout>
    );
  }

  if (!session || !role) {
    return <LoginPage />;
  }

  const conn = connectionMeta[connection];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0} theme="light" width={240}>
        <div style={{ padding: '20px 16px' }}>
          <Title level={4} style={{ margin: 0 }}>
            PigeonTrack
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Palomero Plus Admin
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[tab]}
          items={menuItems}
          onClick={(e) => setTab(e.key as TabKey)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 16,
            padding: '0 24px',
          }}
        >
          <Badge status={conn.status} text={conn.text} />
          <Button
            type="text"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={refresh}
            title="Refresh data"
          />
          <Dropdown
            menu={{
              items: [
                {
                  key: 'signout',
                  icon: <LogoutOutlined />,
                  label: 'Sign out',
                  onClick: () => signOut(),
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small">{(email || '?').charAt(0).toUpperCase()}</Avatar>
              <span>
                <Text style={{ fontSize: 13 }}>{email}</Text>{' '}
                <Tag color={role === 'owner' ? 'blue' : 'default'}>{ROLE_LABELS[role]}</Tag>
              </span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          {tab === 'overview' && allowedTabs.includes('overview') && (
            <OverviewPage data={data} loading={loading} onRefresh={refresh} />
          )}
          {tab === 'users' && allowedTabs.includes('users') && (
            <UsersPage data={data} onChanged={refresh} canBan={permissions.canBanUsers} />
          )}
          {tab === 'contacts' && allowedTabs.includes('contacts') && (
            <ContactsPage data={data} onChanged={refresh} canManage={permissions.canManageContacts} />
          )}
          {tab === 'subscriptions' && allowedTabs.includes('subscriptions') && (
            <SubscriptionsPage data={data} />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
