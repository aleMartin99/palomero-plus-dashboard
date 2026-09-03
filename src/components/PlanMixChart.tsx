import { useMemo } from 'react';
import { Card, Empty, Typography, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AdminDataBundle } from '../types';
import { getUserActivePremiumSub, hasLapsedProSub, isProPlan } from '../lib/helpers';
import { appColors, chartColors } from '../theme/tokens';

const { Text } = Typography;

interface Props {
  data: AdminDataBundle;
}

interface Row {
  key: string;
  label: string;
  value: number;
  color: string;
  hint?: string;
}

/**
 * Replaces the old tier pie. With ~94% of users on Free, the pie was one giant slice and
 * two slivers whose labels collided — the paid split, which is the number that actually
 * matters, was the one thing you couldn't read. The free/paid ratio is a single number, so
 * it's stated as text; the comparison worth drawing is between the paid plans themselves.
 * Bars are directly labelled, so identity never rests on colour alone.
 */
export default function PlanMixChart({ data }: Props) {
  const { t } = useTranslation();
  const { users, plans, subscriptions } = data;

  const { rows, proTotal } = useMemo(() => {
    const activePlanByUser = new Map<string, string>();
    users.forEach((u) => {
      const sub = getUserActivePremiumSub(subscriptions, u.id);
      if (sub) activePlanByUser.set(u.id, sub.plan_id);
    });

    const counts = new Map<string, number>();
    activePlanByUser.forEach((planId) => counts.set(planId, (counts.get(planId) || 0) + 1));

    // Fixed hue order following the plans table — never cycled, so a plan keeps its colour
    // even if another is added or filtered out.
    const hues = [chartColors.secondary, chartColors.primary];
    const paidRows: Row[] = plans
      .filter((p) => isProPlan(p.id))
      .map((p, i) => ({
        key: p.id,
        label: p.name,
        value: counts.get(p.id) || 0,
        color: hues[i % hues.length],
      }));

    const lapsed = users.filter((u) => hasLapsedProSub(subscriptions, u.id)).length;
    if (lapsed > 0) {
      paidRows.push({
        key: 'lapsed',
        label: t('overview.lapsedLabel'),
        value: lapsed,
        color: chartColors.attention,
        hint: t('overview.lapsedHint'),
      });
    }

    return { rows: paidRows, proTotal: activePlanByUser.size };
  }, [users, plans, subscriptions, t]);

  const max = Math.max(...rows.map((r) => r.value), 1);
  const conversion = users.length ? ((proTotal / users.length) * 100).toFixed(1) : '0';

  return (
    <Card title={t('overview.planMixTitle')}>
      <div style={{ height: 260, display: 'flex', flexDirection: 'column' }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t('overview.conversion', {
            pro: proTotal.toLocaleString(),
            total: users.length.toLocaleString(),
            percent: conversion,
          })}
        </Text>

        {rows.every((r) => r.value === 0) ? (
          <Empty
            style={{ margin: 'auto' }}
            description={<Text type="secondary">{t('overview.planMixEmpty')}</Text>}
          />
        ) : (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {rows.map((r) => (
              <div key={r.key}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>
                    {r.label}
                    {r.hint && (
                      <Tooltip title={r.hint}>
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                          ⓘ
                        </Text>
                      </Tooltip>
                    )}
                  </Text>
                  <Text strong style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                    {r.value.toLocaleString()}
                  </Text>
                </div>
                <div
                  style={{
                    height: 10,
                    borderRadius: 5,
                    background: appColors.background,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(r.value / max) * 100}%`,
                      height: '100%',
                      borderRadius: 5,
                      background: r.color,
                      transition: 'width 240ms ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
