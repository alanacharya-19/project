export type ThemeMode = 'light' | 'dark';

export const palette = {
  coral: '#FF6B4A',
  coralDeep: '#E24F2F',
  charcoal: '#0B0C0E',
  ink: '#16171A',
  cream: '#F6F2EA',
  mint: '#6FD8B4',
  gold: '#E8BE72',
  red: '#FF5D62',
  blue: '#7EB8FF',
} as const;

export const darkColors = {
  background: '#0B0C0E',
  backgroundAlt: '#0F1012',
  surface: '#151619',
  surfaceAlt: '#1B1C20',
  surfaceMuted: '#202126',
  overlay: 'rgba(255,255,255,0.06)',
  border: '#2A2C32',
  borderSoft: '#202227',
  text: '#F5F1E9',
  textSecondary: '#A5A6AB',
  textMuted: '#707278',
  accent: palette.coral,
  accentText: '#FFD8CE',
  accentSurface: '#2A1713',
  success: palette.mint,
  successSurface: '#12251F',
  warning: palette.gold,
  warningSurface: '#241E12',
  danger: palette.red,
  dangerSurface: '#261315',
  info: palette.blue,
  infoSurface: '#141E2A',
  shadow: '#000000',
  tabBar: 'rgba(21,22,25,0.96)',
  scrim: 'rgba(0,0,0,0.62)',
};

export const lightColors = {
  background: '#F6F2EA',
  backgroundAlt: '#F1ECE3',
  surface: '#FFFDF8',
  surfaceAlt: '#FFFFFF',
  surfaceMuted: '#EDE8DE',
  overlay: 'rgba(23,24,27,0.04)',
  border: '#E1DACE',
  borderSoft: '#EBE5DB',
  text: '#191A1D',
  textSecondary: '#5F6167',
  textMuted: '#8C8E94',
  accent: palette.coralDeep,
  accentText: '#7A2716',
  accentSurface: '#FFE8E1',
  success: '#1F8D64',
  successSurface: '#E1F4EB',
  warning: '#9A6B1F',
  warningSurface: '#F8EDD4',
  danger: '#D63B43',
  dangerSurface: '#FCE5E5',
  info: '#2868B2',
  infoSurface: '#E4EFFB',
  shadow: '#5B3B27',
  tabBar: 'rgba(255,253,248,0.97)',
  scrim: 'rgba(15,12,9,0.42)',
};

export type ThemeColors = typeof darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 30,
  full: 999,
} as const;

export const typography = {
  hero: { fontSize: 40, lineHeight: 44, fontWeight: '700' as const, letterSpacing: -1.4 },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.9 },
  h2: { fontSize: 23, lineHeight: 29, fontWeight: '700' as const, letterSpacing: -0.5 },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, letterSpacing: -0.25 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: -0.1 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.1 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const, letterSpacing: 0.1 },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500' as const, letterSpacing: 0.1 },
  micro: { fontSize: 10, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 1.4 },
};

export function getShadow(mode: ThemeMode) {
  if (mode === 'dark') {
    return {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.28,
      shadowRadius: 24,
      elevation: 8,
    };
  }
  return {
    shadowColor: '#5B3B27',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 4,
  };
}
