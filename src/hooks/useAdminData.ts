import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AdminDataBundle } from '../types';
import { fetchAllData } from '../lib/api';
import { demoData } from '../lib/demoData';

export type ConnectionState = 'unconfigured' | 'connected' | 'error';

const EMPTY: AdminDataBundle = {
  users: [],
  pigeons: [],
  captures: [],
  contactRequests: [],
  plans: [],
  subscriptions: [],
};

/**
 * @param enabled only fetch once the user is signed in AND has a resolved role — otherwise
 * every request would just bounce off the Edge Function with a 401/403.
 */
export function useAdminData(enabled: boolean) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [data, setData] = useState<AdminDataBundle>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('unconfigured');

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const bundle = await fetchAllData();
      // A viewer's bundle legitimately omits sections their role can't see, so fill in
      // empty arrays rather than letting undefined reach the components.
      setData({ ...EMPTY, ...bundle });
      setConnection('connected');
    } catch (e) {
      console.error('Failed to fetch admin data, showing demo data instead.', e);
      setConnection('error');
      setData(demoData);
      message.error(e instanceof Error ? e.message : t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [enabled, message, t]);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { data, loading, connection, refresh };
}
