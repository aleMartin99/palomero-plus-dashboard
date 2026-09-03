import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Layout,
  Menu,
  Badge,
  Space,
  Typography,
  Dropdown,
  Avatar,
  Tag,
  Spin,
  Button,
  Drawer,
  Grid,
  Tooltip,
} from 'antd';
import {
  PieChartOutlined,
  TeamOutlined,
  MailOutlined,
  CreditCardOutlined,
  LogoutOutlined,
  GlobalOutlined,
  MenuOutlined,
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
const { useBreakpoint } = Grid;

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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = screens.md === false || (typeof window !== 'undefined' && window.innerWidth < 768);

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

  const brandHeader = (
    <div style={{ padding: '20px 16px', borderBottom: `1px solid ${appColors.border}` }}>
      <Title level={4} style={{ margin: 0, color: appColors.primary }}>
        {t('app.name')}
      </Title>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('app.subtitle')}
      </Text>
    </div>
  );

  const navigationMenu = (
    <Menu
      mode="inline"
      selectedKeys={[tab]}
      style={{ borderRight: 0 }}
      items={TAB_ORDER.filter((k) => allowedTabs.includes(k)).map((k) => ({
        key: k,
        icon: MENU_ICONS[k],
        label: t(`nav.${k}`),
      }))}
      onClick={(e) => {
        setTab(e.key as TabKey);
        setMobileDrawerOpen(false);
      }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile ? (
        <Sider theme="light" width={240} style={{ borderRight: `1px solid ${appColors.border}` }}>
          {brandHeader}
          {navigationMenu}
        </Sider>
      ) : (
        <Drawer
          placement="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          width={260}
          styles={{ body: { padding: 0 } }}
        >
          {brandHeader}
          {navigationMenu}
        </Drawer>
      )}
      <Layout>
        <Header
          style={{
            background: appColors.surface,
            borderBottom: `1px solid ${appColors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: isMobile ? '0 16px' : '0 24px',
            height: 64,
            lineHeight: '64px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined style={{ fontSize: 18 }} />}
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Menu"
              />
            )}
            {isMobile && (
              <Title
                level={4}
                style={{
                  margin: 0,
                  color: appColors.primary,
                  fontSize: 16,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {t('app.name')}
              </Title>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, flexShrink: 0 }}>
            {!isMobile ? (
              <Badge status={conn.status} text={conn.text} />
            ) : (
              <Tooltip title={conn.text}>
                <Badge status={conn.status} />
              </Tooltip>
            )}

            <Dropdown menu={languageMenu} placement="bottomRight">
              <Button type="text" icon={<GlobalOutlined />} size={isMobile ? 'small' : 'middle'}>
                {i18n.language.toUpperCase()}
              </Button>
            </Dropdown>

            <Dropdown
              placement="bottomRight"
              menu={{
                items: [
                  {
                    key: 'user-info',
                    disabled: true,
                    label: (
                      <div style={{ padding: '4px 0' }}>
                        <div style={{ fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>{email}</div>
                        <Tag color={role === 'owner' ? 'red' : 'default'} style={{ marginTop: 4 }}>
                          {t(`roles.${role}`)}
                        </Tag>
                      </div>
                    ),
                  },
                  { type: 'divider' },
                  {
                    key: 'signout',
                    icon: <LogoutOutlined />,
                    label: t('app.signOut'),
                    onClick: () => signOut(),
                  },
                ],
              }}
            >
              <Space style={{ cursor: 'pointer' }} size={8}>
                <Avatar size="small" style={{ background: appColors.primary }}>
                  {(email || '?').charAt(0).toUpperCase()}
                </Avatar>
                {!isMobile && (
                  <span>
                    <Text style={{ fontSize: 13 }}>{email}</Text>{' '}
                    <Tag color={role === 'owner' ? 'red' : 'default'}>{t(`roles.${role}`)}</Tag>
                  </span>
                )}
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: isMobile ? '16px 12px' : 24, minHeight: 280 }}>
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
