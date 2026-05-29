export const Colors = {
  dark: {
    bgPrimary: '#0A0B0D',
    bgSecondary: '#111316',
    bgTertiary: '#191C21',
    bgElevated: '#1F2329',
    surface1: '#111316',
    surface2: '#191C21',

    textPrimary: '#F0F2F5',
    textSecondary: '#9CA3AF',
    textTertiary: '#5C6370',

    accentPrimary: '#FF6B9D',
    accentSecondary: '#C44569',
    accentTertiary: '#FF3D7F',
    accentGlow: 'rgba(255, 107, 157, 0.12)',
    accentGlowStrong: 'rgba(255, 107, 157, 0.25)',

    gradientCoral: '#FF5577',
    gradientMagenta: '#D44DF0',
    gradientViolet: '#6A4CF5',
    gradientWarm: '#FF7A3D',

    borderPrimary: 'rgba(255, 255, 255, 0.07)',
    borderSecondary: 'rgba(255, 255, 255, 0.04)',
    borderAccent: 'rgba(255, 107, 157, 0.3)',

    success: '#34D399',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#60A5FA',
    danger: '#F87171',
  },
  light: {
    bgPrimary: '#FAFBFC',
    bgSecondary: '#FFFFFF',
    bgTertiary: '#F3F4F6',
    bgElevated: '#FFFFFF',
    surface1: '#FFFFFF',
    surface2: '#F3F4F6',

    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',

    accentPrimary: '#E0457B',
    accentSecondary: '#B03060',
    accentTertiary: '#FF3D7F',
    accentGlow: 'rgba(224, 69, 123, 0.08)',
    accentGlowStrong: 'rgba(224, 69, 123, 0.18)',

    gradientCoral: '#FF5577',
    gradientMagenta: '#D44DF0',
    gradientViolet: '#6A4CF5',
    gradientWarm: '#FF7A3D',

    borderPrimary: 'rgba(0, 0, 0, 0.06)',
    borderSecondary: 'rgba(0, 0, 0, 0.03)',
    borderAccent: 'rgba(224, 69, 123, 0.25)',

    success: '#059669',
    error: '#DC2626',
    warning: '#D97706',
    info: '#2563EB',
    danger: '#DC2626',
  },
} as const;

export type ThemeColors = {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  surface1: string;
  surface2: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accentPrimary: string;
  accentSecondary: string;
  accentTertiary: string;
  accentGlow: string;
  accentGlowStrong: string;
  gradientCoral: string;
  gradientMagenta: string;
  gradientViolet: string;
  gradientWarm: string;
  borderPrimary: string;
  borderSecondary: string;
  borderAccent: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  danger: string;
};
export type ColorScheme = 'dark' | 'light';
