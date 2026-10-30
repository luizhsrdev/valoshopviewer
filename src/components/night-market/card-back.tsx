import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { colors, space, withAlpha } from '@/theme';

import { Text } from '../text';

/**
 * Capa da carta do mercado noturno: uma grade de losangos na cor da
 * raridade (desenho próprio, sem arte da Riot).
 *
 * Revelação, guiada por um único relógio `clock` (0 → 1 em REVEAL.total ms):
 * 1. os enfeites somem;
 * 2. os losangos acendem do centro para fora (losango, depois "X");
 * 3. clarão quando a carta inteira acende (mais forte nas raridades altas);
 * 4. os losangos se desfazem do centro para os cantos, revelando a skin.
 */

export const REVEAL = {
  total: 1500,
  lightSpread: 420,
  lightDur: 180,
  fadeStart: 700,
  fadeSpread: 520,
  fadeDur: 260,
} as const;

/** Momento (ms) em que o conteúdo da carta começa a aparecer pelos buracos. */
export const CONTENT_AT = REVEAL.fadeStart;

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};
const easeOut = (v: number) => {
  'worklet';
  return 1 - (1 - v) * (1 - v);
};

/** Mistura duas cores #RRGGBB (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

type Tile = { key: string; x: number; y: number; delay: number };

/**
 * Grade de losangos que cobre a carta inteira: quadrados girados 45°, com
 * centros em (i·d/2, j·d/2) e i + j par, encaixam sem buracos.
 */
function buildTiles(width: number, height: number, diagonal: number): Tile[] {
  const half = diagonal / 2;
  const cx = width / 2;
  const cy = height / 2;
  const raw: { key: string; x: number; y: number; r: number; d: number }[] = [];
  for (let i = -1; i <= Math.ceil(width / half) + 1; i++) {
    for (let j = -1; j <= Math.ceil(height / half) + 1; j++) {
      if ((i + j) % 2 !== 0) continue;
      const x = i * half;
      const y = j * half;
      // Mesma unidade nos dois eixos, para o "X" sair a 45° na tela.
      const nx = Math.abs(x - cx) / cx;
      const ny = Math.abs(y - cy) / cx;
      raw.push({ key: `${i}:${j}`, x, y, r: nx + ny, d: Math.abs(nx - ny) });
    }
  }
  const maxR = Math.max(...raw.map((t) => t.r));
  const maxD = Math.max(...raw.map((t) => t.d));
  // Distância "losango" (r) + preferência pelas diagonais (d) = losango, depois X.
  return raw.map((t) => ({ key: t.key, x: t.x, y: t.y, delay: 0.55 * (t.r / maxR) + 0.45 * (t.d / maxD) }));
}

type Props = {
  color: string | null;
  rank: number;
  width: number;
  height: number;
  /** null = em repouso (Views estáticas, sem custo de animação). */
  clock: SharedValue<number> | null;
};

export const CardCover = memo(function CardCover({ color, rank, width, height, clock }: Props) {
  const tint = color ?? colors.mute;
  const base = mix(tint, colors.canvas, 0.62);
  const lit = tint;
  const line = 'rgba(0,0,0,0.22)';
  const diagonal = Math.max(28, width / 4);
  const size = (diagonal / Math.SQRT2) * 1.04; // leve sobreposição evita frestas
  const tiles = useMemo(() => (width > 0 ? buildTiles(width, height, diagonal) : []), [width, height, diagonal]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: base }]}>
      {tiles.map((t) =>
        clock ? (
          <AnimatedTile key={t.key} tile={t} size={size} base={base} lit={lit} line={line} clock={clock} />
        ) : (
          <View key={t.key} style={[tileBox(t, size, line), { backgroundColor: base }]} />
        ),
      )}
      <Ornaments tint={tint} clock={clock} />
      {clock ? <Flash rank={rank} clock={clock} /> : null}
      {clock ? <LitBorder tint={tint} clock={clock} /> : null}
    </View>
  );
});

function tileBox(t: Tile, size: number, line: string) {
  return {
    position: 'absolute' as const,
    left: t.x - size / 2,
    top: t.y - size / 2,
    width: size,
    height: size,
    borderWidth: 1,
    borderColor: line,
    transform: [{ rotate: '45deg' }],
  };
}

const AnimatedTile = memo(function AnimatedTile({
  tile,
  size,
  base,
  lit,
  line,
  clock,
}: {
  tile: Tile;
  size: number;
  base: string;
  lit: string;
  line: string;
  clock: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = clock.get() * REVEAL.total;
    const a = easeOut(clamp01((t - tile.delay * REVEAL.lightSpread) / REVEAL.lightDur));
    const f = easeOut(clamp01((t - REVEAL.fadeStart - tile.delay * REVEAL.fadeSpread) / REVEAL.fadeDur));
    return {
      backgroundColor: interpolateColor(a, [0, 1], [base, lit]),
      opacity: 1 - f,
      transform: [{ rotate: '45deg' }, { scale: 1 - 0.45 * f }],
    };
  });
  return <Animated.View style={[tileBox(tile, size, line), style]} />;
});

/** Enfeites do verso em repouso; somem logo no início da revelação. */
function Ornaments({ tint, clock }: { tint: string; clock: SharedValue<number> | null }) {
  const style = useAnimatedStyle(() => ({
    opacity: clock ? 1 - clamp01((clock.get() * REVEAL.total) / 160) : 1,
  }));
  const strong = withAlpha(tint, 0.85);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.25)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <View style={[styles.diamond, { width: 92, height: 92, borderColor: withAlpha(tint, 0.55) }]} />
        <View style={[styles.diamond, { width: 46, height: 46, borderColor: strong, backgroundColor: withAlpha(tint, 0.25) }]} />
        <View style={[styles.diamond, { width: 12, height: 12, backgroundColor: strong, borderColor: strong }]} />
      </View>
      <View style={styles.caption}>
        <Text variant="micro" color={colors.ink} style={{ opacity: 0.7 }}>
          TOQUE PARA REVELAR
        </Text>
      </View>
    </Animated.View>
  );
}

/** Clarão quando a carta inteira acende: mais forte nas raridades altas. */
function Flash({ rank, clock }: { rank: number; clock: SharedValue<number> }) {
  const peak = 0.06 + Math.max(0, Math.min(4, rank)) * 0.07;
  const style = useAnimatedStyle(() => {
    const t = clock.get() * REVEAL.total;
    const up = clamp01((t - 420) / 200);
    const down = clamp01((t - 620) / 260);
    return { opacity: peak * up * (1 - down) };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, styles.flash, style]} pointerEvents="none" />;
}

/** A borda acende na cor da raridade enquanto a carta acende. */
function LitBorder({ tint, clock }: { tint: string; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: clamp01((clock.get() * REVEAL.total - 200) / 300),
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, styles.border, { borderColor: tint }, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  diamond: { position: 'absolute', borderWidth: 1, transform: [{ rotate: '45deg' }] },
  caption: { position: 'absolute', bottom: space.lg, left: 0, right: 0, alignItems: 'center' },
  flash: { backgroundColor: '#FFFFFF' },
  border: { borderWidth: 2 },
});
