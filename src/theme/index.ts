/**
 * Tema do app — tradução do DESIGN.md (Raycast) para React Native.
 *
 * Princípios herdados do Raycast:
 * - Só modo escuro. Fundo quase preto, bordas hairline de 1px.
 * - Profundidade pela "escada" de superfícies, não por sombras.
 * - Tipografia Inter com letter-spacing levemente positivo.
 *
 * Adaptações para este app:
 * - Um único acento: vermelho #FF4655 (substitui o branco como cor de ação
 *   apenas onde precisa chamar atenção; o botão primário continua branco).
 * - Cores de raridade (valorant-api.com/v1/contenttiers) como destaque dos cards.
 * - A única "sombra" é o brilho sutil da raridade (glow), usado com moderação.
 */
import type { TextStyle, ViewStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------

export const colors = {
  // Escada de superfícies (canvas → card = mais perto do usuário)
  canvas: '#07080A',
  surface: '#0D0D0D',
  surfaceElevated: '#101111',
  surfaceCard: '#121212',
  /** Base do skeleton e do "pressed" de superfícies. */
  surfacePressed: '#18191A',

  // Bordas
  hairline: '#242728',
  hairlineSoft: 'rgba(255,255,255,0.08)',
  hairlineStrong: 'rgba(255,255,255,0.16)',

  // Texto
  ink: '#F4F4F6', // títulos
  body: '#CDCDCD', // texto corrido
  mute: '#9C9C9D', // secundário
  ash: '#6A6B6C', // terciário / desabilitado
  stone: '#434345', // ícones apagados

  // Ação primária (Raycast: branco)
  primary: '#FFFFFF',
  primaryPressed: '#E8E8E8',
  onPrimary: '#000000',

  // Acento único
  accent: '#FF4655',
  accentPressed: '#E63E4C',
  accentSoft: 'rgba(255,70,85,0.15)',
  onAccent: '#FFFFFF',

  // Semânticas (erro reaproveita o acento — sem cores extras)
  danger: '#FF4655',
  dangerSoft: 'rgba(255,70,85,0.15)',

  /** Véu sobre imagens para garantir contraste do texto. */
  scrim: 'rgba(7,8,10,0.72)',
} as const;

// ---------------------------------------------------------------------------
// Raridade (contenttiers)
// ---------------------------------------------------------------------------

/**
 * UUIDs e cores de `valorant-api.com/v1/contenttiers` (o campo highlightColor
 * vem como RRGGBBAA com alpha 33; aqui guardamos só o RGB).
 * Servem de fallback offline; em execução preferimos a cor vinda da API.
 */
export const rarity = {
  '12683d76-48d7-84a3-4e09-6985794f0445': { name: 'Select', color: '#5A9FE2', rank: 0 },
  '0cebb8be-46d7-c12a-d306-e9907bfc5a25': { name: 'Deluxe', color: '#009587', rank: 1 },
  '60bca009-4182-7998-dee7-b8a2558dc369': { name: 'Premium', color: '#D1548D', rank: 2 },
  'e046854e-406c-37f4-6607-19a9ba8426fc': { name: 'Exclusive', color: '#F5955B', rank: 3 },
  '411e4a55-4e59-7757-41f0-86a53f101bb5': { name: 'Ultra', color: '#FAD663', rank: 4 },
} as const;

export type RarityId = keyof typeof rarity;

/** Cor neutra para itens sem raridade (ex.: acessórios). */
export const rarityFallback = colors.hairlineStrong;

/** Converte `#RRGGBB` em `rgba()` com a opacidade pedida. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '').slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Normaliza `highlightColor` da API (RRGGBBAA) para `#RRGGBB`. */
export function rarityHex(highlightColor: string): string {
  return `#${highlightColor.slice(0, 6).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Tipografia
// ---------------------------------------------------------------------------

/** Nomes registrados via @expo-google-fonts/inter no layout raiz. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

/**
 * Escala do Raycast reduzida para celular. O `ss03` (g alternativo) não é
 * suportado pelo React Native no Android; os demais traços se mantêm.
 */
export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 34, letterSpacing: 0 },
  title: { fontFamily: fonts.medium, fontSize: 22, lineHeight: 28, letterSpacing: 0.2 },
  heading: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 24, letterSpacing: 0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, letterSpacing: 0.2 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0.2 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  micro: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.6 },
  /** Números que mudam (preço, saldo, contagem): largura fixa, sem "pular". */
  numeric: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextStyle>;

// ---------------------------------------------------------------------------
// Espaçamento, raios, bordas
// ---------------------------------------------------------------------------

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16, // gutter lateral da tela
  xl: 24,
  xxl: 32,
  section: 48, // Raycast usa 96 no desktop; metade no celular
} as const;

export const radius = {
  xs: 4, // chips, tags
  sm: 6, // linhas, botões pequenos
  md: 8, // botões, inputs, cards de oferta
  lg: 10, // cards médios
  xl: 16, // destaque do pacote
  full: 9999,
} as const;

export const border = {
  hairline: { borderWidth: 1, borderColor: colors.hairline },
  strong: { borderWidth: 1, borderColor: colors.hairlineStrong },
} as const satisfies Record<string, ViewStyle>;

// ---------------------------------------------------------------------------
// Elevação / sombras
// ---------------------------------------------------------------------------

/**
 * Raycast não usa sombras: elevação = escada de superfícies.
 * Mantemos só o brilho de raridade, aplicado a cards de skin.
 */
export const elevation = {
  flat: { backgroundColor: colors.canvas },
  low: { backgroundColor: colors.surface, ...border.hairline },
  mid: { backgroundColor: colors.surfaceElevated, ...border.hairline },
  high: { backgroundColor: colors.surfaceCard, ...border.hairline },
} as const satisfies Record<string, ViewStyle>;

/**
 * Brilho sutil na cor da raridade. `boxShadow` funciona no Android
 * com a New Architecture (padrão no SDK atual).
 */
export function rarityGlow(hex: string, strength: 'subtle' | 'hero' = 'subtle'): ViewStyle {
  const alpha = strength === 'hero' ? 0.28 : 0.18;
  const blur = strength === 'hero' ? 32 : 16;
  return {
    borderWidth: 1,
    borderColor: withAlpha(hex, 0.55),
    boxShadow: `0 0 ${blur}px ${withAlpha(hex, alpha)}`,
  };
}

// ---------------------------------------------------------------------------
// Movimento (reanimated)
// ---------------------------------------------------------------------------

export const motion = {
  fast: 150,
  base: 220,
  slow: 360,
  /** Pulso do skeleton (ida e volta). */
  shimmer: 1100,
  spring: { damping: 18, stiffness: 180, mass: 1 },
} as const;

export const theme = { colors, rarity, fonts, type, space, radius, border, elevation, motion } as const;
export type Theme = typeof theme;
