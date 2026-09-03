/**
 * Design tokens mirrored from the Flutter app's theme so the dashboard reads as the same
 * product. Source of truth: pigeon_track/lib/core/theme/app_colors.dart + app_theme.dart.
 * The app defaults to its LIGHT theme, so that's what we match.
 */
export const appColors = {
  primary: '#B71C1C', // AppColors.primary — Crimson Red
  onPrimary: '#FFFFFF',
  secondary: '#455A64', // AppColors.secondary — Steel Grey/Blue
  surface: '#FFFFFF',
  background: '#F5F5F5', // scaffoldBackgroundColor
  onSurface: '#1A1A1A',
  error: '#B00020',
  border: '#E0E0E0',
  textMuted: '#9E9E9E',
  // Not in AppColors — the de-facto success/warning the app uses across subscription UI.
  success: '#4CAF50',
  warning: '#FFA726',
} as const;

/** AppTheme radius tokens: small 8, medium 12, large 16. */
export const appRadius = { small: 8, medium: 12, large: 16 } as const;

/**
 * Chart palette. Deliberately NOT the raw brand pair: the app's steel-grey secondary
 * (#455A64) and any grey fail the chroma floor for chart marks — they read as "no data"
 * rather than as a series. These three were validated together on a white surface
 * (lightness band, chroma floor, colour-blind separation, and 3:1 contrast all pass),
 * keeping the brand crimson as the lead hue.
 */
export const chartColors = {
  /** Lead series / brand. */
  primary: '#B71C1C',
  /** Second categorical hue. */
  secondary: '#0891B2',
  /** Attention state (lapsed, stale). */
  attention: '#B45309',
  /** Recessive grid + axis ink. */
  axis: '#8C8C8C',
} as const;
