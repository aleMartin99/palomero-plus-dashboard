import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Layout } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const { Title, Text, Paragraph } = Typography;

export default function LoginPage() {
  const { signIn, unauthorized, signOut, email } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: { email: string; password: string }) {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(values.email.trim(), values.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  // Valid Supabase credentials, but this email isn't on the dashboard allowlist.
  if (unauthorized) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <Card style={{ maxWidth: 420, width: '100%' }}>
          <Title level={4} style={{ marginTop: 0 }}>
            No dashboard access
          </Title>
          <Paragraph type="secondary">
            <Text code>{email}</Text> signed in successfully, but that address isn't on this
            dashboard's allowlist. Ask the owner to add it to the{' '}
            <Text code>ADMIN_ROLES</Text> secret.
          </Paragraph>
          <Button block onClick={signOut}>
            Sign out
          </Button>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <Card style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 0 }}>
            PigeonTrack
          </Title>
          <Text type="secondary">Palomero Plus Admin</Text>
        </div>

        {!isSupabaseConfigured && (
          <Alert
            type="warning"
            message="Environment Variables Missing"
            description="Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel Project Settings."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false} disabled={submitting}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: 'Enter your email' }]}
          >
            <Input prefix={<MailOutlined />} autoComplete="username" placeholder="you@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Enter your password' }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Sign in
          </Button>
        </Form>

        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
          Access is limited to allowlisted accounts.
        </Paragraph>
      </Card>
    </Layout>
  );
}
