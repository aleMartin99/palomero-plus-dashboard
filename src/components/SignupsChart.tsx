import { useMemo, useState } from 'react';
import { Card, Segmented, Space, Empty, Typography } from 'antd';
import { Column, Line } from '@ant-design/charts';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { AdminUser } from '../types';
import { chartColors } from '../theme/tokens';

const { Text } = Typography;

type RangeKey = '7' | '30' | '90' | 'all';
type ModeKey = 'new' | 'cumulative';

interface Props {
  users: AdminUser[];
}

/**
 * Replaces the old all-time signups line. Two things were wrong with that chart:
 * the x-axis was categorical, so a four-month gap between signup days rendered the same
 * width as a single day (a flat period read as steady growth); and one 390-signup spike
 * squashed every other day onto the baseline. Here the window is bounded and every day in
 * it is present — including zero days — so the spacing is honest and recent activity is
 * actually legible.
 */
export default function SignupsChart({ users }: Props) {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeKey>('30');
  const [mode, setMode] = useState<ModeKey>('new');

  const perDay = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach((u) => {
      if (!u.created_at) return;
      const day = dayjs(u.created_at).format('YYYY-MM-DD');
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    return counts;
  }, [users]);

  const series = useMemo(() => {
    if (perDay.size === 0) return [];

    const days = [...perDay.keys()].sort();
    const firstDay = dayjs(days[0]);
    const today = dayjs().startOf('day');
    const start = range === 'all' ? firstDay : today.subtract(Number(range) - 1, 'day');
    const from = start.isBefore(firstDay) ? firstDay : start;

    // Signups that happened before the window still count toward the running total.
    let running = 0;
    days.forEach((d) => {
      if (dayjs(d).isBefore(from, 'day')) running += perDay.get(d) || 0;
    });

    const out: { date: string; value: number }[] = [];
    for (let d = from; !d.isAfter(today, 'day'); d = d.add(1, 'day')) {
      const key = d.format('YYYY-MM-DD');
      const count = perDay.get(key) || 0;
      running += count;
      out.push({ date: key, value: mode === 'new' ? count : running });
    }
    return out;
  }, [perDay, range, mode]);

  const label = mode === 'new' ? t('overview.newUsers') : t('overview.totalUsersSeries');

  const common = {
    data: series,
    xField: 'date',
    yField: 'value',
    height: 260,
    axis: {
      x: {
        labelAutoHide: true,
        labelAutoRotate: false,
        labelFormatter: (v: string) => dayjs(v).format('D MMM'),
      },
      y: { labelFormatter: (v: number) => `${v}` },
    },
    scale: { y: { nice: true } },
    tooltip: {
      title: (d: { date: string }) => dayjs(d.date).format('dddd, D MMM YYYY'),
      items: [{ channel: 'y' as const, name: label }],
    },
  };

  return (
    <Card
      title={t('overview.signupsTitle')}
      styles={{
        header: { flexWrap: 'wrap', gap: 8, height: 'auto', minHeight: 56, padding: '12px 16px' },
      }}
      extra={
        <Space wrap size={[8, 8]}>
          <Segmented
            size="small"
            value={mode}
            onChange={(v) => setMode(v as ModeKey)}
            options={[
              { label: t('overview.signupsNew'), value: 'new' },
              { label: t('overview.signupsCumulative'), value: 'cumulative' },
            ]}
          />
          <Segmented
            size="small"
            value={range}
            onChange={(v) => setRange(v as RangeKey)}
            options={[
              { label: t('overview.range7'), value: '7' },
              { label: t('overview.range30'), value: '30' },
              { label: t('overview.range90'), value: '90' },
              { label: t('overview.rangeAll'), value: 'all' },
            ]}
          />
        </Space>
      }
    >
      <div style={{ height: 260 }}>
        {series.length === 0 ? (
          <Empty description={<Text type="secondary">{t('overview.signupsEmpty')}</Text>} />
        ) : mode === 'new' ? (
          <Column {...common} style={{ fill: chartColors.primary, radiusTopLeft: 4, radiusTopRight: 4 }} />
        ) : (
          <Line {...common} style={{ stroke: chartColors.primary, lineWidth: 2 }} />
        )}
      </div>
    </Card>
  );
}
