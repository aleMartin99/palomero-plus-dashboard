import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import type { AdminDataBundle } from '../types';
import { fetchAllData, isConfigured } from '../lib/api';
import { demoData } from '../lib/demoData';

export type ConnectionState = 'unconfigured' | 'connected' | 'error';

export function useAdminData() {
  const { message } = App.useApp();
  const [data, setData] = useState<AdminDataBundle>(demoData);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('unconfigured');

  const refresh = useCallback(async () => {
    if (!isConfigured()) {
      setConnection('unconfigured');
      setData(demoData);
      return;
    }
    setLoading(true);
    try {
      const bundle = await fetchAllData();
      setData(bundle);
      setConnection('connected');
    } catch (e) {
      console.error('Failed to fetch admin data, showing demo data instead.', e);
      setConnection('error');
      setData(demoData);
      message.error(e instanceof Error ? e.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, connection, refresh };
}
