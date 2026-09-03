import { useMemo, useState } from 'react';
import { Typography, Segmented, Card, Empty, Tag, Button, Space, App, Row, Col } from 'antd';
import { CheckOutlined, CloseOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AdminDataBundle, ContactStatus, ContactType } from '../types';
import { updateContactStatus } from '../lib/api';

const { Title, Text, Paragraph } = Typography;

interface Props {
  data: AdminDataBundle;
  onChanged: () => void;
  /** Owner-only. The Edge Function enforces this too — hiding the buttons is just UX. */
  canManage: boolean;
}

export default function ContactsPage({ data, onChanged, canManage }: Props) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [typeFilter, setTypeFilter] = useState<'all' | 'support' | 'bug' | 'feedback'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'pending' | 'solved' | 'closed'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function typeTagFor(type: ContactType) {
    const s = (type || '').toLowerCase();
    if (s.includes('bug') || s.includes('error')) return { color: 'red', label: t('contacts.tagBug') };
    if (s.includes('support') || s.includes('help'))
      return { color: 'blue', label: t('contacts.tagSupport') };
    return { color: 'purple', label: t('contacts.tagFeedback') };
  }

  function statusTagFor(status: ContactStatus) {
    if (status === 'new') return { color: 'magenta', label: t('contacts.badgeNew') };
    if (status === 'pending') return { color: 'gold', label: t('contacts.badgePending') };
    if (status === 'solved') return { color: 'green', label: t('contacts.badgeSolved') };
    return { color: 'default', label: t('contacts.badgeClosed') };
  }

  const filtered = useMemo(() => {
    return data.contactRequests.filter((c) => {
      const type = (c.type || '').toLowerCase();
      let typeMatch = typeFilter === 'all';
      if (typeFilter === 'bug') typeMatch = type.includes('bug') || type.includes('error');
      else if (typeFilter === 'support') typeMatch = type.includes('support') || type.includes('help');
      else if (typeFilter === 'feedback')
        typeMatch = type.includes('feedback') || type.includes('other') || type.includes('suggest');

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
      message.error(e instanceof Error ? e.message : t('contacts.updateFailed'));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            {t('contacts.title')}
          </Title>
          <Text type="secondary">{t('contacts.subtitle')}</Text>
        </Col>
        <Col>
          <Space direction="vertical" size={8} align="end">
            <Segmented
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as typeof typeFilter)}
              options={[
                { label: t('contacts.filterAll'), value: 'all' },
                { label: t('contacts.filterSupport'), value: 'support' },
                { label: t('contacts.filterBugs'), value: 'bug' },
                { label: t('contacts.filterFeedback'), value: 'feedback' },
              ]}
            />
            <Segmented
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { label: t('contacts.statusAll'), value: 'all' },
                { label: t('contacts.statusNew'), value: 'new' },
                { label: t('contacts.statusPending'), value: 'pending' },
                { label: t('contacts.statusSolved'), value: 'solved' },
                { label: t('contacts.statusClosed'), value: 'closed' },
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
              description={t('contacts.empty')}
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
                  hoverable={canManage}
                  style={{ opacity: status === 'solved' || status === 'closed' ? 0.65 : 1 }}
                  onClick={() => {
                    if (canManage && status === 'new') setStatus(c.id, 'pending');
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
                        {t('contacts.by')} <Text strong>{c.user_email}</Text>
                      </Text>
                    </Col>
                    <Col>
                      <Space onClick={(e) => e.stopPropagation()}>
                        {canManage && status === 'new' && (
                          <Button
                            size="small"
                            loading={actionLoading === c.id}
                            onClick={() => setStatus(c.id, 'pending')}
                          >
                            {t('contacts.investigate')}
                          </Button>
                        )}
                        {canManage && status !== 'solved' && (
                          <Button
                            size="small"
                            icon={<CheckOutlined />}
                            loading={actionLoading === c.id}
                            onClick={() => setStatus(c.id, 'solved')}
                          >
                            {t('contacts.solve')}
                          </Button>
                        )}
                        {canManage && status !== 'closed' && (
                          <Button
                            size="small"
                            danger
                            icon={<CloseOutlined />}
                            loading={actionLoading === c.id}
                            onClick={() => setStatus(c.id, 'closed')}
                          >
                            {t('contacts.close')}
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
