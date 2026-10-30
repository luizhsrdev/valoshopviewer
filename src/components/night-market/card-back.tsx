import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { colors, withAlpha } from '@/theme';

/**
 * Capa da carta do mercado noturno: uma grade de losangos na cor da
 * raridade (desenho próprio, sem arte da Riot).
 *
 * Revelação, guiada por um único relógio `clock` (0 → 1 em REVEAL.total ms):
 * 1. os enfeites somem;
 * 2. o "X" sai na frente, do centro até as pontas; logo atrás dele, os
 *    vizinhos começam a clarear (primeiro perto do centro e do X), sem mexer
 *    na borda da carta;
 * 3. clarão quando a carta inteira acende (mais forte nas raridades altas);
 * 4. os losangos se desfazem do centro para os cantos, revelando a skin, que
 *    já está pronta por baixo.
 *
 * Desempenho: 49 losangos, uma View cada, sem borda, animando só opacidade
 * e escala. O tom escuro é um fundo único por trás deles. Ver PROJETO.md 6.12.
 */

export const REVEAL = {
  total: 1450,
  /** O X cresce do centro às pontas. */
  xSpread: 220,
  xDur: 140,
  /** Os vizinhos clareiam logo atrás do X: atraso fixo + um passo por losango de distância. */
  fillLag: 70,
  fillStep: 70,
  fillDur: 170,
  /** Os losangos somem do centro para fora. */
  fadeStart: 740,
  fadeSpread: 470,
  fadeDur: 240,
  /** Clarão quando a carta inteira está acesa. */
  flashAt: 560,
} as const;

/** Opacidade da camada clara quando o X passa (o "tom acima" antes de acender). */
const MID = 0.25;

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

/** Tempos (ms) de cada losango. */
type Tile = { key: string; x: number; y: number; onX: boolean; xAt: number; litAt: number; fadeAt: number };

/**
 * Grade de losangos que cobre a carta inteira: quadrados girados 45°, com
 * centros em (cx + i·d/2, cy + j·d/2) e i + j par, encaixam sem buracos.
 * A grade é ancorada no centro da carta, então sempre há um losango
 * exatamente no meio e o X sai simétrico. O X são os losangos com |i| = |j|.
 */
function buildTiles(width: number, height: number, diagonal: number): Tile[] {
  const half = diagonal / 2;
  const cx = width / 2;
  const cy = height / 2;
  const ni = Math.ceil(cx / half) + 1;
  const nj = Math.ceil(cy / half) + 1;

  const raw: { key: string; x: number; y: number; k: number; e: number; r: number; onX: boolean }[] = [];
  for (let i = -ni; i <= ni; i++) {
    for (let j = -nj; j <= nj; j++) {
      if ((i + j) % 2 !== 0) continue;
      const x = cx + i * half;
      const y = cy + j * half;
      // Fora dessa margem o losango não encosta na carta.
      if (x < -half || x > width + half || y < -half || y > height + half) continue;
      const di = Math.abs(i);
      const dj = Math.abs(j);
      raw.push({
        key: `${i}:${j}`,
        x,
        y,
        k: Math.max(di, dj), // anel em torno do centro
        e: Math.abs(di - dj) / 2, // passos até o X
        r: Math.abs(x - cx) / cx + Math.abs(y - cy) / cx, // distância "losango" na tela
        onX: di === dj,
      });
    }
  }
  const maxK = Math.max(...raw.filter((t) => t.onX).map((t) => t.k), 1);
  const maxR = Math.max(...raw.map((t) => t.r), 1);
  return raw.map((t) => {
    const xAt = (Math.min(t.k, maxK) / maxK) * REVEAL.xSpread;
    return {
      key: t.key,
      x: t.x,
      y: t.y,
      onX: t.onX,
      xAt,
      // Logo atrás do X que passa pelo seu anel, mais um passo por losango de distância do X.
      litAt: xAt + REVEAL.fillLag + t.e * REVEAL.fillStep,
      fadeAt: REVEAL.fadeStart + (t.r / maxR) * REVEAL.fadeSpread,
    };
  });
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
  // 49 losangos (~60% dos 83 de antes): cada um é uma View animada, e o custo
  // cresce com a quantidade. Com a grade centrada, a quantidade sobe em degraus (25, 49, 59…).
  const diagonal = Math.max(28, width / 3.2);
  const size = (diagonal / Math.SQRT2) * 1.06; // sobreposição evita frestas
  const tiles = useMemo(() => (width > 0 ? buildTiles(width, height, diagonal) : []), [width, height, diagonal]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]}>
      {/* Tom escuro: um fundo só, por trás de todos os losangos. */}
      {clock ? <BaseLayer color={base} clock={clock} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} />}
      {clock ? tiles.map((t) => <AnimatedTile key={t.key} tile={t} size={size} lit={tint} clock={clock} />) : null}
      <Ornaments tint={tint} clock={clock} />
      {clock ? <Flash rank={rank} clock={clock} /> : null}
    </View>
  );
});

/**
 * O fundo escuro some quando todos os losangos já estão acesos (cobrindo a
 * carta inteira), para os buracos mostrarem a skin.
 */
function BaseLayer({ color, clock }: { color: string; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: clock.get() * REVEAL.total < REVEAL.fadeStart - 20 ? 1 : 0 }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
}

/** Posição do losango. */
function tileBox(t: Tile, size: number) {
  return {
    position: 'absolute' as const,
    left: t.x - size / 2,
    top: t.y - size / 2,
    width: size,
    height: size,
  };
}

/**
 * Uma View por losango, só com opacidade e escala (as propriedades mais
 * baratas de animar): aparece sobre o fundo escuro ("tom acima" quando o X
 * passa, cheio quando acende) e depois some e encolhe.
 */
const AnimatedTile = memo(function AnimatedTile({
  tile,
  size,
  lit,
  clock,
}: {
  tile: Tile;
  size: number;
  lit: string;
  clock: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = clock.get() * REVEAL.total;
    const x = easeOut(clamp01((t - tile.xAt) / REVEAL.xDur));
    const on = tile.onX ? x : MID * x + (1 - MID) * easeOut(clamp01((t - tile.litAt) / REVEAL.fillDur));
    const f = easeOut(clamp01((t - tile.fadeAt) / REVEAL.fadeDur));
    return { opacity: on * (1 - f), transform: [{ rotate: '45deg' }, { scale: 1 - 0.45 * f }] };
  });
  return <Animated.View style={[tileBox(tile, size), { backgroundColor: lit }, style]} />;
});

/** Enfeites do verso em repouso; somem logo no início da revelação. */
function Ornaments({ tint, clock }: { tint: string; clock: SharedValue<number> | null }) {
  const style = useAnimatedStyle(() => ({
    opacity: clock ? 1 - clamp01((clock.get() * REVEAL.total) / 140) : 1,
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
    </Animated.View>
  );
}

/** Clarão quando a carta inteira acende: mais forte nas raridades altas. */
function Flash({ rank, clock }: { rank: number; clock: SharedValue<number> }) {
  const peak = 0.06 + Math.max(0, Math.min(4, rank)) * 0.07;
  const style = useAnimatedStyle(() => {
    const t = clock.get() * REVEAL.total;
    const up = clamp01((t - REVEAL.flashAt) / 120);
    const down = clamp01((t - REVEAL.flashAt - 120) / 240);
    return { opacity: peak * up * (1 - down) };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, styles.flash, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  diamond: { position: 'absolute', borderWidth: 1, transform: [{ rotate: '45deg' }] },
  flash: { backgroundColor: '#FFFFFF' },
});
