import type { ReactNode } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { useTranslation } from 'react-i18next';
import { ANTD_LOCALES, type Language } from './i18n';
import { appColors, appRadius } from './theme/tokens';

/**
 * Ant Design theme mapped onto the Flutter app's light palette, plus the locale for
 * Ant Design's own built-in strings (pagination, table filters, Popconfirm, empty states)
 * — those are not covered by our translation files.
 */
export default function ThemedApp({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const lang = (i18n.language as Language) in ANTD_LOCALES ? (i18n.language as Language) : 'es';

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[lang]}
      theme={{
        token: {
          colorPrimary: appColors.primary,
          colorError: appColors.error,
          colorSuccess: appColors.success,
          colorWarning: appColors.warning,
          colorInfo: appColors.secondary,
          colorTextBase: appColors.onSurface,
          colorBgLayout: appColors.background,
          colorBorderSecondary: appColors.border,
          borderRadius: appRadius.medium,
          fontFamily:
            "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Layout: {
            headerBg: appColors.surface,
            siderBg: appColors.surface,
            bodyBg: appColors.background,
          },
          Menu: { itemBorderRadius: appRadius.small },
          Card: { borderRadiusLG: appRadius.large },
          Button: { controlHeight: 36 },
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
