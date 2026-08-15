// ─── Thème unique ChrisRoi Agence — Warm Earth V5 (validé 17/07/2026, refonte 01/08/2026)
// ─── Source de vérité : une seule palette, importée par tous les écrans.
// ─── Fini : les objets de thème `M` copiés localement dans chaque écran.
import type { TextStyle } from 'react-native';

// ─── Couleurs — Warm Earth (terracotta / sable / olive) ───
export const Colors = {
  // Fond
  bg: '#fdf8f3',
  bgElevated: '#fffaf5',
  bgCard: '#ffffff',
  bgCardAlt: '#fef7f0',
  background: '#fdf8f3',
  surface: '#ffffff',
  surfaceAlt: '#fef7f0',

  // Primaire terracotta
  primary: '#c45a2a',
  primaryDim: '#fdebd8',
  primaryLight: '#fdebd8',
  primaryDark: '#a3481f',
  primaryStrong: '#e8a77f',
  primaryFaded: '#f6d9c2',
  glow: 'rgba(196,90,42,0.12)',

  // Succès olive
  success: '#5a7c3a',
  successDim: '#e8f0dc',
  successLight: '#e8f0dc',
  successDark: '#46652c',

  // Avertissement or vieilli
  warning: '#b8860b',
  warningDim: '#faf3d1',
  warningLight: '#faf3d1',
  warningDark: '#8f6909',

  // Info sarcelle chaude
  info: '#2a7a7a',
  infoDim: '#d8ecec',
  infoLight: '#d8ecec',
  infoDark: '#1f5c5c',

  // Violet prune doux
  violet: '#8b5a8b',
  violetDim: '#f0e6f0',

  // Rose rouge brique
  rose: '#b85454',
  roseDim: '#fdeaea',
  danger: '#b85454',
  dangerLight: '#fdeaea',
  dangerDark: '#944343',

  // Textes
  text: '#3d3530',
  textMuted: '#8a7d72',
  textDim: '#b8a99e',
  textPrimary: '#3d3530',
  textSecondary: '#8a7d72',
  textTertiary: '#b8a99e',
  textOnPrimary: '#ffffff',
  disabled: '#b8a99e',
  textOnDisabled: '#f9f4ee',

  // Bordures
  border: '#eedec9',
  borderSoft: '#f5ebe0',
  borderLight: '#f5ebe0',
  borderSubtle: '#f5ebe0',
  divider: '#eedec9',
  separator: '#f5ebe0',

  // Icônes
  icon: '#8a7d72',
  iconMedium: '#6b5f55',
  iconLight: '#b8a99e',

  // Divers
  pulse: '#5a7c3a',
  highlight: '#faf3d1',
} as const;

// ─── Typographie ──────────────────────────────────────────
const _typo = {
  h1: { fontSize: 26, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  h4: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.4, textTransform: 'uppercase' as const },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  number: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28, fontVariant: ['tabular-nums' as const] },
};

// Aliases legacy (pour compatibilité avec les écrans existants)
export const Typography = {
  ..._typo,
  displayLarge: _typo.h1,
  titleLarge: _typo.h2,
  titleMedium: _typo.h3,
  titleSmall: _typo.h4,
  bodyLarge: _typo.body,
  bodyMedium: _typo.body,
  bodyStrong: _typo.h4,
  labelSmall: _typo.label,
};
export type TypographyKey = keyof typeof Typography;

// ─── Espacement ───────────────────────────────────────────
export const Spacing = {
  xs: 4,
  s: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 32,
} as const;

// ─── Coins arrondis ───────────────────────────────────────
export const Radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

// ─── Ombres (warm) ────────────────────────────────────────
export const Shadows = {
  card: {
    shadowColor: 'rgba(61,53,48,0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  elevated: {
    shadowColor: 'rgba(61,53,48,0.10)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 6,
  },
  soft: {
    shadowColor: 'rgba(61,53,48,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
} as const;
