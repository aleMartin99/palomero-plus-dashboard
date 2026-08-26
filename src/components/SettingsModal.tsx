import { useState } from 'react';
import { Modal, Form, Input, Typography, App } from 'antd';
import { getStoredAdminSecret, setStoredAdminSecret, clearStoredAdminSecret } from '../lib/adminSecret';

const { Text, Paragraph } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ open, onClose, onSaved }: Props) {
  const { message } = App.useApp();
  const [secret, setSecret] = useState(getStoredAdminSecret());

  function handleSave() {
    if (!secret.trim()) {
      message.warning('Enter the admin access key first, or use "Clear key" to go back to demo data.');
      return;
    }
    setStoredAdminSecret(secret.trim());
    onSaved();
    onClose();
  }

  function handleClear() {
    clearStoredAdminSecret();
    setSecret('');
    onSaved();
  }

  return (
    <Modal
      title="Dashboard access"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      okText="Save & connect"
      cancelText="Cancel"
    >
      <Paragraph type="secondary" style={{ fontSize: 13 }}>
        This dashboard talks to Supabase through the <Text code>admin-dashboard-api</Text> Edge
        Function, not directly. Enter the admin access key configured for that function (its{' '}
        <Text code>ADMIN_DASHBOARD_KEY</Text> secret) — the raw database key never leaves the
        server.
      </Paragraph>
      <Form layout="vertical">
        <Form.Item label="Admin access key">
          <Input.Password
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Paste the x-admin-secret value"
            autoFocus
          />
        </Form.Item>
      </Form>
      <Text type="secondary" style={{ fontSize: 12, cursor: 'pointer' }} onClick={handleClear}>
        Clear key and use demo data
      </Text>
    </Modal>
  );
}
