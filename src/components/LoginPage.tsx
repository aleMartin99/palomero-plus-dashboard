import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Layout, Dropdown } from 'antd';
import { LockOutlined, MailOutlined, GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { appColors } from '../theme/tokens';

const { Title, Text, Paragraph } = Typography;

interface Props {
  /** Language picker, so the login screen can be read before signing in. */
  languageMenu: React.ComponentProps<typeof Dropdown>['menu'];
}

export default function LoginPage({ languageMenu }: Props) {
  const { t, i18n } = useTranslation();
  const { signIn, unauthorized, signOut, email } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: { email: string; password: string }) {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(values.email.trim(), values.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const langButton = (
    <div style={{ position: 'fixed', top: 16, right: 16 }}>
      <Dropdown menu={languageMenu}>
        <Button type="text" icon={<GlobalOutlined />}>
          {i18n.language.toUpperCase()}
        </Button>
      </Dropdown>
    </div>
  );

  if (unauthorized) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        {langButton}
        <Card style={{ maxWidth: 440, width: '100%' }}>
          <Title level={4} style={{ marginTop: 0 }}>
            {t('login.noAccessTitle')}
          </Title>
          <Paragraph type="secondary">
            <Text code>{email}</Text> — {t('login.noAccessBody')}
          </Paragraph>
          <Button block onClick={signOut}>
            {t('app.signOut')}
          </Button>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      {langButton}
      <Card style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 0, color: appColors.primary }}>
            {t('app.name')}
          </Title>
          <Text type="secondary">{t('app.subtitle')}</Text>
        </div>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false} disabled={submitting}>
          <Form.Item
            name="email"
            label={t('login.email')}
            rules={[{ required: true, message: t('login.emailRequired') }]}
          >
            <Input prefix={<MailOutlined />} autoComplete="username" placeholder="you@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('login.password')}
            rules={[{ required: true, message: t('login.passwordRequired') }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            {t('login.submit')}
          </Button>
        </Form>

        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
          {t('login.restricted')}
        </Paragraph>
      </Card>
    </Layout>
  );
}
