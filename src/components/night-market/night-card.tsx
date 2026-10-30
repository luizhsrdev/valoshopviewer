import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { formatNumber } from '@/lib/format';
import type { NightOffer } from '@/lib/shop';
import { colors, radius, rarityFallback, space, withAlpha } from '@/theme';

import { Text } from '../text';
import { CardBack } from './card-back';

/**
 * Intensidade do brilho por raridade (rank 0 = Select … 4 = Ultra).
 * `peak` é o clarão durante a revelação; `rest` é o que fica depois.
 */
function glowFor(rank: number) {
  const r = Math.max(0, Math.min(4, rank));
  return { peak: 0.3 + r * 0.14, rest: 0.1 + r * 0.035, scale: 1 + r * 0.18 };
}

/** Linha do tempo da revelação (ms). */
const T = { flip: 560, glowAt: 220, glowUp: 420, glowDown: 700, contentAt: 500, badgeAt: 760, finalAt: 860 };

type Props = {
  offer: NightOffer;
  index: number;
  revealed: boolean;
  /** Se true, a carta aparece já revelada, sem animação. */
  instant: boolean;
  onReveal(id: string): void;
  /** Toque numa carta já revelada: abre os detalhes da skin. */
  onOpen(offer: NightOffer): void;
};

export const NightCard = memo(function NightCard({ offer, index, revealed, instant, onReveal, onOpen }: Props) {
  const color = offer.tier?.color ?? null;
  const rank = offer.tier?.rank ?? 0;
  const glow = glowFor(rank);

  const flip = useSharedValue(revealed ? 1 : 0);
  const spread = useSharedValue(revealed ? 1 : 0);
  const intensity = useSharedValue(revealed ? glow.rest : 0);
  const content = useSharedValue(revealed ? 1 : 0);
  const badge = useSharedValue(revealed ? 1 : 0);
  const final = useSharedValue(revealed ? 1 : 0);

  useEffect(() => {
    if (!revealed || flip.value === 1) return;
    if (instant) {
      flip.value = 1;
      spread.value = 1;
      intensity.value = glow.rest;
      content.value = 1;
      badge.value = 1;
      final.value = 1;
      return;
    }
    flip.value = withTiming(1, { duration: T.flip, easing: Easing.out(Easing.cubic) });
    spread.value = withDelay(T.glowAt, withTiming(1, { duration: T.glowUp + T.glowDown, easing: Easing.out(Easing.quad) }));
    intensity.value = withDelay(
      T.glowAt,
      withSequence(
        withTiming(glow.peak, { duration: T.glowUp, easing: Easing.out(Easing.quad) }),
        withTiming(glow.rest, { duration: T.glowDown, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    content.value = withDelay(T.contentAt, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    badge.value = withDelay(T.badgeAt, withSpring(1, { damping: 9, stiffness: 240, mass: 0.7 }));
    final.value = withDelay(T.finalAt, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, instant]);

  // Duas faces giram juntas; trocamos a visível em 90° (mais confiável no
  // Android do que backfaceVisibility).
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 900 }, { rotateY: `${flip.value * 180 - 180}deg` }],
  }));

  const a11yRevealed = `${offer.name}. De ${formatNumber(offer.basePrice)} por ${formatNumber(offer.finalPrice)} VP, ${offer.discountPercent}% de desconto. Toque para ver os detalhes.`;

  return (
    <View style={styles.slot}>
      <Animated.View style={[styles.face, frontStyle]} pointerEvents={revealed ? 'auto' : 'none'}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => onOpen(offer)}
          disabled={!revealed || !offer.skinUuid}
          accessible={revealed}
          accessibilityRole="button"
          accessibilityLabel={a11yRevealed}>
          <Front offer={offer} color={color} glow={glow} spread={spread} intensity={intensity} content={content} badge={badge} final={final} />
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[styles.face, styles.backFace, color ? { borderColor: withAlpha(color, 0.5) } : null, backStyle]}
        pointerEvents={revealed ? 'none' : 'auto'}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => onReveal(offer.id)}
          disabled={revealed}
          accessibilityRole="button"
          accessibilityLabel={`Carta ${index + 1} de 6, virada para baixo. Toque para revelar.`}>
          <CardBack color={color} />
        </Pressable>
      </Animated.View>
    </View>
  );
});

function Front({
  offer,
  color,
  glow,
  spread,
  intensity,
  content,
  badge,
  final,
}: {
  offer: NightOffer;
  color: string | null;
  glow: ReturnType<typeof glowFor>;
  spread: SharedValue<number>;
  intensity: SharedValue<number>;
  content: SharedValue<number>;
  badge: SharedValue<number>;
  final: SharedValue<number>;
}) {
  const tint = color ?? colors.mute;

  const glowStyle = useAnimatedStyle(() => ({
    opacity: intensity.value,
    transform: [{ scale: interpolate(spread.value, [0, 1], [0.15, glow.scale]) }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ translateY: (1 - content.value) * 10 }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.value * 1.5),
    transform: [{ scale: interpolate(badge.value, [0, 1], [0.5, 1]) }],
  }));
  const finalStyle = useAnimatedStyle(() => ({
    opacity: final.value,
    transform: [{ translateY: (1 - final.value) * 6 }],
  }));

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.front,
        {
          borderColor: color ? withAlpha(color, 0.6) : rarityFallback,
          backgroundColor: color ? withAlpha(color, 0.08) : colors.surfaceCard,
        },
      ]}>
      {/* Brilho: três círculos concêntricos, centrados na carta, dão uma borda suave sem blur. */}
      <View style={styles.glowCenter} pointerEvents="none">
        <Animated.View style={[styles.glow, glowStyle]}>
          <View style={[styles.ring, { width: '100%', backgroundColor: withAlpha(tint, 0.22) }]} />
          <View style={[styles.ring, { width: '72%', backgroundColor: withAlpha(tint, 0.3) }]} />
          <View style={[styles.ring, { width: '46%', backgroundColor: withAlpha(tint, 0.45) }]} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.frontBody, contentStyle]}>
        <View style={styles.imageBox}>
          <Image source={offer.image ?? undefined} style={styles.image} contentFit="contain" cachePolicy="disk" />
        </View>
        <Text variant="label" color={colors.ink} numberOfLines={2}>
          {offer.name}
        </Text>
        <View style={styles.priceRow}>
          <Text variant="caption" color={colors.ash} style={styles.strike}>
            {formatNumber(offer.basePrice)}
          </Text>
          <Animated.View style={[styles.badge, { backgroundColor: withAlpha(tint, 0.2), borderColor: withAlpha(tint, 0.5) }, badgeStyle]}>
            <Text variant="micro" color={tint}>
              −{offer.discountPercent}%
            </Text>
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.finalRow, finalStyle]}>
        <Text variant="numeric" color={colors.ink} style={styles.finalPrice}>
          {formatNumber(offer.finalPrice)}
        </Text>
        <Text variant="caption" color={colors.mute}>
          VP
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, aspectRatio: 0.68 },
  face: { ...StyleSheet.absoluteFill, borderRadius: radius.lg, overflow: 'hidden' },
  backFace: { borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceElevated },
  front: { borderRadius: radius.lg, borderWidth: 1, padding: space.md, justifyContent: 'space-between' },
  glowCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  glow: { width: '140%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', aspectRatio: 1, borderRadius: 9999 },
  frontBody: { gap: space.sm },
  imageBox: { aspectRatio: 1.7, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  strike: { textDecorationLine: 'line-through' },
  badge: { borderRadius: radius.xs, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  finalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  finalPrice: { fontSize: 20, lineHeight: 26 },
});
