import { useState } from 'react';
import { Layout, Menu, Badge, Space, Typography, Button } from 'antd';
import {
  PieChartOutlined,
  TeamOutlined,
  MailOutlined,
  CreditCardOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import OverviewPage from './components/OverviewPage';
import UsersPage from './components/UsersPage';
import ContactsPage from './components/ContactsPage';
import SubscriptionsPage from './components/SubscriptionsPage';
import SettingsModal from './components/SettingsModal';
import { useAdminData } from './hooks/useAdminData';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

type TabKey = 'overview' | 'users' | 'contacts' | 'subscriptions';

const menuItems = [
  { key: 'overview', icon: <PieChartOutlined />, label: 'Overview' },
  { key: 'users', icon: <TeamOutlined />, label: 'Users' },
  { key: 'contacts', icon: <MailOutlined />, label: 'Contact Requests' },
  { key: 'subscriptions', icon: <CreditCardOutlined />, label: 'Subscriptions' },
];

const connectionMeta = {
  unconfigured: { status: 'error' as const, text: 'Disconnected (setup key)' },
  connected: { status: 'success' as const, text: 'Connected' },
  error: { status: 'warning' as const, text: 'Connection failed — showing demo data' },
};

export default function App() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data, loading, connection, refresh } = useAdminData();

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
            padding: '0 24px',
          }}
        >
          <Space style={{ cursor: 'pointer' }} onClick={() => setSettingsOpen(true)}>
            <Badge status={conn.status} text={conn.text} />
            <Button type="text" icon={<SettingOutlined />} />
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          {tab === 'overview' && <OverviewPage data={data} loading={loading} onRefresh={refresh} />}
          {tab === 'users' && <UsersPage data={data} onChanged={refresh} />}
          {tab === 'contacts' && <ContactsPage data={data} onChanged={refresh} />}
          {tab === 'subscriptions' && <SubscriptionsPage data={data} />}
        </Content>
      </Layout>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={refresh} />
    </Layout>
  );
}
