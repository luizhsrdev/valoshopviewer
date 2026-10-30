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
 * Desempenho: cada losango é uma base fixa + uma camada clara por cima; só se
 * animam opacidade e escala (nada de interpolar cor a cada quadro).
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
 * centros em (i·d/2, j·d/2) e i + j par, encaixam sem buracos. O X são os
 * losangos com |Δi| = |Δj| a partir do losango central.
 */
function buildTiles(width: number, height: number, diagonal: number): Tile[] {
  const half = diagonal / 2;
  const cx = width / 2;
  const cy = height / 2;

  // Losango central: o vizinho válido (i + j par) mais próximo do centro.
  let ci = 0;
  let cj = 0;
  let best = Infinity;
  for (const i of [Math.floor(cx / half), Math.ceil(cx / half)]) {
    for (const j of [Math.floor(cy / half), Math.ceil(cy / half)]) {
      const dist = Math.hypot(i * half - cx, j * half - cy);
      if ((i + j) % 2 === 0 && dist < best) {
        best = dist;
        ci = i;
        cj = j;
      }
    }
  }

  const raw: { key: string; x: number; y: number; k: number; e: number; r: number; onX: boolean }[] = [];
  for (let i = -1; i <= Math.ceil(width / half) + 1; i++) {
    for (let j = -1; j <= Math.ceil(height / half) + 1; j++) {
      if ((i + j) % 2 !== 0) continue;
      const di = Math.abs(i - ci);
      const dj = Math.abs(j - cj);
      const x = i * half;
      const y = j * half;
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
  // Contorno entre os losangos bem discreto.
  const line = 'rgba(0,0,0,0.035)';
  const diagonal = Math.max(28, width / 4);
  const size = (diagonal / Math.SQRT2) * 1.06; // sobreposição evita frestas
  const tiles = useMemo(() => (width > 0 ? buildTiles(width, height, diagonal) : []), [width, height, diagonal]);

  return (
    // Sem fundo próprio: quando um losango some, aparece a skin por baixo.
    <View style={[StyleSheet.absoluteFill, styles.clip, width > 0 ? null : { backgroundColor: base }]}>
      {tiles.map((t) =>
        clock ? (
          <AnimatedTile key={t.key} tile={t} size={size} base={base} lit={tint} line={line} clock={clock} />
        ) : (
          <View key={t.key} style={[tileBox(t, size), styles.staticLine, { backgroundColor: base, borderColor: line }]} />
        ),
      )}
      <Ornaments tint={tint} clock={clock} />
      {clock ? <Flash rank={rank} clock={clock} /> : null}
    </View>
  );
});

/** Posição do losango. Sem borda: a linha fica em cada camada (veja AnimatedTile). */
function tileBox(t: Tile, size: number) {
  return {
    position: 'absolute' as const,
    left: t.x - size / 2,
    top: t.y - size / 2,
    width: size,
    height: size,
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
  // Base: some e encolhe na fase final.
  const baseStyle = useAnimatedStyle(() => {
    const f = easeOut(clamp01((clock.get() * REVEAL.total - tile.fadeAt) / REVEAL.fadeDur));
    return { opacity: 1 - f, transform: [{ rotate: '45deg' }, { scale: 1 - 0.45 * f }] };
  });
  // Camada clara: o X acende direto; os demais sobem um tom e depois acendem.
  const litStyle = useAnimatedStyle(() => {
    const t = clock.get() * REVEAL.total;
    const x = easeOut(clamp01((t - tile.xAt) / REVEAL.xDur));
    if (tile.onX) return { opacity: x };
    const l = easeOut(clamp01((t - tile.litAt) / REVEAL.fillDur));
    return { opacity: MID * x + (1 - MID) * l };
  });
  return (
    // Duas camadas do mesmo tamanho, cada uma com a sua linha discreta. O
    // losango em si não tem borda nem fundo: no Android, a camada de cima é
    // cortada por dentro da borda do pai, e a borda escura virava uma grade forte.
    <Animated.View style={[tileBox(tile, size), baseStyle]}>
      <View style={[styles.layer, { backgroundColor: base, borderColor: line }]} />
      <Animated.View style={[styles.layer, { backgroundColor: lit, borderColor: line }, litStyle]} />
    </Animated.View>
  );
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
  layer: { ...StyleSheet.absoluteFill, borderWidth: 1 },
  staticLine: { borderWidth: 1 },
});
