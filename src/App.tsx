import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Layout, Menu, Badge, Space, Typography, Dropdown, Avatar, Tag, Spin, Button } from 'antd';
import {
  PieChartOutlined,
  TeamOutlined,
  MailOutlined,
  CreditCardOutlined,
  LogoutOutlined,
  ReloadOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import OverviewPage from './components/OverviewPage';
import UsersPage from './components/UsersPage';
import ContactsPage from './components/ContactsPage';
import SubscriptionsPage from './components/SubscriptionsPage';
import LoginPage from './components/LoginPage';
import { useAdminData } from './hooks/useAdminData';
import { useAuth } from './lib/auth';
import { type TabKey } from './lib/roles';
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, setLanguage } from './i18n';
import { appColors } from './theme/tokens';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const MENU_ICONS: Record<TabKey, ReactNode> = {
  overview: <PieChartOutlined />,
  users: <TeamOutlined />,
  contacts: <MailOutlined />,
  subscriptions: <CreditCardOutlined />,
};

const TAB_ORDER: TabKey[] = ['overview', 'users', 'contacts', 'subscriptions'];

export default function App() {
  const { t, i18n } = useTranslation();
  const { session, email, role, permissions, loading: authLoading, signOut } = useAuth();
  const [tab, setTab] = useState<TabKey>('overview');
  const { data, loading, connection, refresh } = useAdminData(Boolean(role));

  const allowedTabs = permissions.tabs;

  useEffect(() => {
    if (allowedTabs.length && !allowedTabs.includes(tab)) {
      setTab(allowedTabs[0]);
    }
  }, [allowedTabs, tab]);

  const languageMenu = {
    items: SUPPORTED_LANGUAGES.map((lang) => ({
      key: lang,
      label: LANGUAGE_LABELS[lang],
      onClick: () => setLanguage(lang),
    })),
    selectedKeys: [i18n.language],
  };

  if (authLoading) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </Layout>
    );
  }

  if (!session || !role) {
    return <LoginPage languageMenu={languageMenu} />;
  }

  const conn = {
    unconfigured: { status: 'default' as const, text: t('connection.unconfigured') },
    connected: { status: 'success' as const, text: t('connection.connected') },
    error: { status: 'warning' as const, text: t('connection.error') },
  }[connection];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0} theme="light" width={240}>
        <div style={{ padding: '20px 16px' }}>
          <Title level={4} style={{ margin: 0, color: appColors.primary }}>
            {t('app.name')}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('app.subtitle')}
          </Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[tab]}
          items={TAB_ORDER.filter((k) => allowedTabs.includes(k)).map((k) => ({
            key: k,
            icon: MENU_ICONS[k],
            label: t(`nav.${k}`),
          }))}
          onClick={(e) => setTab(e.key as TabKey)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: appColors.surface,
            borderBottom: `1px solid ${appColors.border}`,
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
            title={t('app.refresh')}
          />
          <Dropdown menu={languageMenu}>
            <Button type="text" icon={<GlobalOutlined />} title={t('app.language')}>
              {i18n.language.toUpperCase()}
            </Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'signout',
                  icon: <LogoutOutlined />,
                  label: t('app.signOut'),
                  onClick: () => signOut(),
                },
              ],
            }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" style={{ background: appColors.primary }}>
                {(email || '?').charAt(0).toUpperCase()}
              </Avatar>
              <span>
                <Text style={{ fontSize: 13 }}>{email}</Text>{' '}
                <Tag color={role === 'owner' ? 'red' : 'default'}>{t(`roles.${role}`)}</Tag>
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
