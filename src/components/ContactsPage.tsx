import { useMemo, useState } from 'react';
import { Typography, Segmented, Card, Empty, Tag, Button, Space, App, Row, Col } from 'antd';
import { CheckOutlined, CloseOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import type { AdminDataBundle, ContactStatus, ContactType } from '../types';
import { updateContactStatus } from '../lib/api';

const { Title, Text, Paragraph } = Typography;

interface Props {
  data: AdminDataBundle;
  onChanged: () => void;
}

const typeTag: Record<string, { color: string; label: string }> = {
  bug: { color: 'red', label: 'Bug' },
  support: { color: 'blue', label: 'Support' },
};

function typeTagFor(type: ContactType) {
  const t = (type || '').toLowerCase();
  if (t.includes('bug') || t.includes('error')) return typeTag.bug;
  if (t.includes('support') || t.includes('help')) return typeTag.support;
  return { color: 'purple', label: 'Feedback / Other' };
}

function statusTagFor(status: ContactStatus) {
  if (status === 'new') return { color: 'magenta', label: 'New' };
  if (status === 'pending') return { color: 'gold', label: 'Pending' };
  if (status === 'solved') return { color: 'green', label: 'Solved' };
  return { color: 'default', label: 'Closed' };
}

export default function ContactsPage({ data, onChanged }: Props) {
  const { message } = App.useApp();
  const [typeFilter, setTypeFilter] = useState<'all' | 'support' | 'bug' | 'feedback'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'pending' | 'solved' | 'closed'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return data.contactRequests.filter((c) => {
      const type = (c.type || '').toLowerCase();
      let typeMatch = typeFilter === 'all';
      if (typeFilter === 'bug') typeMatch = type.includes('bug') || type.includes('error');
      else if (typeFilter === 'support') typeMatch = type.includes('support') || type.includes('help');
      else if (typeFilter === 'feedback') typeMatch = type.includes('feedback') || type.includes('other') || type.includes('suggest');

      const status = c.status || 'new';
      const statusMatch = statusFilter === 'all' || status === statusFilter;

      return typeMatch && statusMatch;
    });
  }, [data.contactRequests, typeFilter, statusFilter]);

  async function setStatus(contactId: string, status: string) {
    setActionLoading(contactId);
    try {
      await updateContactStatus(contactId, status);
      onChanged();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update request.');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Contact Requests & Support
          </Title>
          <Text type="secondary">Manage user feedback, bug reports, and support forms.</Text>
        </Col>
        <Col>
          <Space direction="vertical" size={8} align="end">
            <Segmented
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as typeof typeFilter)}
              options={[
                { label: 'All', value: 'all' },
                { label: 'Support', value: 'support' },
                { label: 'Bugs', value: 'bug' },
                { label: 'Feedback', value: 'feedback' },
              ]}
            />
            <Segmented
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { label: 'All', value: 'all' },
                { label: 'New', value: 'new' },
                { label: 'Pending', value: 'pending' },
                { label: 'Solved', value: 'solved' },
                { label: 'Closed', value: 'closed' },
              ]}
            />
          </Space>
        </Col>
      </Row>

      <div style={{ marginTop: 24 }}>
        {filtered.length === 0 ? (
          <Card>
            <Empty
              image={<QuestionCircleOutlined style={{ fontSize: 32 }} />}
              description="No contact requests found in this category."
            />
          </Card>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {filtered.map((c) => {
              const status = c.status || 'new';
              const tt = typeTagFor(c.type);
              const st = statusTagFor(status);
              return (
                <Card
                  key={c.id}
                  hoverable
                  style={{ opacity: status === 'solved' || status === 'closed' ? 0.65 : 1 }}
                  onClick={() => {
                    if (status === 'new') setStatus(c.id, 'pending');
                  }}
                >
                  <Row justify="space-between" gutter={[16, 16]}>
                    <Col flex="auto">
                      <Space wrap>
                        <Tag color={tt.color}>{tt.label}</Tag>
                        <Tag color={st.color}>{st.label}</Tag>
                        <Text strong style={{ fontSize: 15 }}>
                          {c.subject}
                        </Text>
                      </Space>
                      <Paragraph style={{ marginTop: 8, marginBottom: 8 }}>{c.description}</Paragraph>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        By: <Text strong>{c.user_email}</Text>
                      </Text>
                    </Col>
                    <Col>
                      <Space onClick={(e) => e.stopPropagation()}>
                        {status === 'new' && (
                          <Button size="small" loading={actionLoading === c.id} onClick={() => setStatus(c.id, 'pending')}>
                            Investigate
                          </Button>
                        )}
                        {status !== 'solved' && (
                          <Button
                            size="small"
                            icon={<CheckOutlined />}
                            loading={actionLoading === c.id}
                            onClick={() => setStatus(c.id, 'solved')}
                          >
                            Solve
                          </Button>
                        )}
                        {status !== 'closed' && (
                          <Button
                            size="small"
                            danger
                            icon={<CloseOutlined />}
                            loading={actionLoading === c.id}
                            onClick={() => setStatus(c.id, 'closed')}
                          >
                            Close
                          </Button>
                        )}
                      </Space>
                    </Col>
                  </Row>
                </Card>
              );
            })}
          </Space>
        )}
      </div>
    </div>
  );
}
