import { DefaultTheme } from '@react-navigation/native';

export const colors = {
  primary: '#7D1A3D',
  primaryDark: '#5E0F2C',
  primaryLight: '#A12651',
  accent: '#D4AF37',
  bg: '#FAF6F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F2EEEA',
  border: '#E6E1DC',
  text: '#1B1B1B',
  textMuted: '#6F6A66',
  disabled: '#C9C5C2',
  success: '#2E7D5B',
  danger: '#B3261E',
  // Avatar tints used in the mock-ups for stylists
  avatarTints: ['#7D1A3D', '#1F3D2B', '#3F1B6B', '#0E5A6B', '#8A5A00'],
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const typography = {
  display: { fontSize: 28, fontWeight: '800' },
  h1: { fontSize: 22, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '500' },
  small: { fontSize: 13, fontWeight: '500' },
  tiny: { fontSize: 11, fontWeight: '600' },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};

export const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};
