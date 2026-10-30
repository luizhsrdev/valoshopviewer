import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { formatNumber } from '@/lib/format';
import type { NightOffer } from '@/lib/shop';
import { colors, radius, rarityFallback, space, withAlpha } from '@/theme';

import { Text } from '../text';
import { CardCover, CONTENT_AT, REVEAL } from './card-back';

/** Linha do tempo do conteúdo (ms), alinhada com a capa que se desfaz. */
const T = { contentAt: CONTENT_AT, badgeAt: CONTENT_AT + 450, finalAt: CONTENT_AT + 550 };

/**
 * Os losangos animados são montados logo depois que a tela abre, uma carta
 * por vez (montar ~80 no toque causava um engasgo). No toque, só o relógio anda.
 */
const ARM_AFTER = 350;
const ARM_STAGGER = 90;

type Phase = 'cover' | 'playing' | 'done';

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
  const [size, setSize] = useState({ width: 0, height: 0 });
  // cover: capa parada · playing: revelando · done: só a frente.
  const [phase, setPhase] = useState<Phase>(revealed ? 'done' : 'cover');
  const [armed, setArmed] = useState(false);

  const clock = useSharedValue(0);
  const content = useSharedValue(revealed ? 1 : 0);
  const badge = useSharedValue(revealed ? 1 : 0);
  const final = useSharedValue(revealed ? 1 : 0);

  // Prepara os losangos animados com a carta ainda parada.
  useEffect(() => {
    if (revealed) return;
    const id = setTimeout(() => setArmed(true), ARM_AFTER + index * ARM_STAGGER);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!revealed || phase !== 'cover') return;
    if (instant) {
      content.set(1);
      badge.set(1);
      final.set(1);
      const id = setTimeout(() => setPhase('done'), 0);
      return () => clearTimeout(id);
    }
    if (!armed) {
      // Tocou antes de preparar: prepara agora e começa no próximo render.
      const id = setTimeout(() => setArmed(true), 0);
      return () => clearTimeout(id);
    }
    clock.set(withTiming(1, { duration: REVEAL.total, easing: Easing.linear }));
    content.set(withDelay(T.contentAt, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })));
    badge.set(withDelay(T.badgeAt, withSpring(1, { damping: 9, stiffness: 240, mass: 0.7 })));
    final.set(withDelay(T.finalAt, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) })));
    const id = setTimeout(() => setPhase('playing'), 0);
    return () => clearTimeout(id);
  }, [revealed, instant, armed, phase, clock, content, badge, final]);

  // Desmonta a capa quando ela termina de se desfazer.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setTimeout(() => setPhase('done'), REVEAL.total + 50);
    return () => clearTimeout(id);
  }, [phase]);

  const coverGone = phase === 'done';

  const a11yRevealed = `${offer.name}. De ${formatNumber(offer.basePrice)} por ${formatNumber(offer.finalPrice)} VP, ${offer.discountPercent}% de desconto. Toque para ver os detalhes.`;

  return (
    <View
      style={styles.slot}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => onOpen(offer)}
        disabled={!coverGone || !offer.skinUuid}
        accessible={revealed}
        accessibilityRole="button"
        accessibilityLabel={a11yRevealed}>
        <Front offer={offer} color={color} content={content} badge={badge} final={final} />
      </Pressable>

      {!coverGone ? (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.cover, color ? { borderColor: withAlpha(color, 0.5) } : null]}
          onPress={() => onReveal(offer.id)}
          disabled={revealed}
          accessibilityRole="button"
          accessibilityLabel={`Carta ${index + 1} de 6, virada para baixo. Toque para revelar.`}>
          <CardCover
            color={color}
            rank={rank}
            width={size.width}
            height={size.height}
            clock={armed ? clock : null}
          />
        </Pressable>
      ) : null}
    </View>
  );
});

function Front({
  offer,
  color,
  content,
  badge,
  final,
}: {
  offer: NightOffer;
  color: string | null;
  content: SharedValue<number>;
  badge: SharedValue<number>;
  final: SharedValue<number>;
}) {
  const tint = color ?? colors.mute;

  // A capa é opaca, então a skin já fica visível por baixo dela: aparece no
  // primeiro losango que some. `content` só dá um leve zoom de entrada.
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(content.get(), [0, 1], [0.92, 1]) }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.get() * 1.5),
    transform: [{ scale: interpolate(badge.get(), [0, 1], [0.5, 1]) }],
  }));
  const finalStyle = useAnimatedStyle(() => ({
    opacity: final.get(),
    transform: [{ translateY: (1 - final.get()) * 6 }],
  }));

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.front,
        {
          borderColor: color ? withAlpha(color, 0.6) : rarityFallback,
          backgroundColor: color ? withAlpha(color, 0.1) : colors.surfaceCard,
        },
      ]}>
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
          <Animated.View
            style={[styles.badge, { backgroundColor: withAlpha(tint, 0.2), borderColor: withAlpha(tint, 0.5) }, badgeStyle]}>
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
  cover: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.hairline },
  front: { borderRadius: radius.lg, borderWidth: 1, padding: space.md, justifyContent: 'space-between', overflow: 'hidden' },
  frontBody: { gap: space.sm },
  imageBox: { aspectRatio: 1.5, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  strike: { textDecorationLine: 'line-through' },
  badge: { borderRadius: radius.xs, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  finalRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  finalPrice: { fontSize: 20, lineHeight: 26 },
});
