import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import { formatNumber } from '@/lib/format';
import type { NightOffer } from '@/lib/shop';
import { colors, radius, rarityFallback, space, withAlpha } from '@/theme';

import { Text } from '../text';
import { WishHeart } from '../wish-heart';
import { CardCover, REVEAL } from './card-back';

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
      const id = setTimeout(() => setPhase('done'), 0);
      return () => clearTimeout(id);
    }
    if (!armed) {
      // Tocou antes de preparar: prepara agora e começa no próximo render.
      const id = setTimeout(() => setArmed(true), 0);
      return () => clearTimeout(id);
    }
    clock.set(withTiming(1, { duration: REVEAL.total, easing: Easing.linear }));
    const id = setTimeout(() => setPhase('playing'), 0);
    return () => clearTimeout(id);
  }, [revealed, instant, armed, phase, clock]);

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
        <Front offer={offer} color={color} width={size.width} />
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

/** Proporção da caixa da arma (os renders são largos e baixos). */
const WEAPON_ASPECT = 3.2;

function Front({
  offer,
  color,
  width,
}: {
  offer: NightOffer;
  color: string | null;
  width: number;
}) {
  const tint = color ?? colors.mute;

  // Arma na horizontal, com uma margem de cada lado.
  const length = width > 0 ? width * 0.86 : 0;

  // Tudo aqui é estático: a capa opaca por cima é a única animação. A skin
  // aparece pelo primeiro losango que some.
  return (
    <View style={[StyleSheet.absoluteFill, styles.front, { borderColor: color ? withAlpha(color, 0.6) : rarityFallback }]}>
      <LinearGradient
        colors={[withAlpha(tint, 0.34), withAlpha(tint, 0.14), withAlpha(tint, 0.06)]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Arma no centro do buraco que a capa abre. */}
      <View style={styles.weaponCenter} pointerEvents="none">
        {length > 0 ? (
          <View style={{ width: length, height: length / WEAPON_ASPECT }}>
            <Image source={offer.image ?? undefined} style={styles.image} contentFit="contain" cachePolicy="disk" />
          </View>
        ) : null}
      </View>

      {/* Desconto em vermelho no canto superior esquerdo, com a ponta cortada. */}
      <View style={styles.discount}>
        <View style={styles.discountBody}>
          <Text variant="micro" color={colors.onAccent} style={styles.discountText}>
            −{offer.discountPercent}%
          </Text>
        </View>
        <View style={styles.discountTip} />
      </View>

      {/* Preço final e original no canto superior direito. */}
      <View style={styles.prices}>
        <View style={styles.priceLine}>
          <Text variant="micro" color={colors.mute}>
            VP
          </Text>
          <Text variant="numeric" color={colors.ink} style={styles.finalPrice}>
            {formatNumber(offer.finalPrice)}
          </Text>
        </View>
        <Text variant="micro" color={colors.ash} style={styles.strike}>
          {formatNumber(offer.basePrice)}
        </Text>
      </View>

      {/* Nome centralizado embaixo, sem barra. */}
      <View style={styles.nameBox}>
        <Text variant="label" color={colors.ink} numberOfLines={2} style={styles.name}>
          {offer.name.toUpperCase()}
        </Text>
      </View>

      <WishHeart skinUuid={offer.skinUuid} name={offer.name} size={15} style={styles.heart} />
    </View>
  );
}

const DISCOUNT_H = 22;

const styles = StyleSheet.create({
  slot: { flex: 1, aspectRatio: 0.68 },
  cover: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.hairline },
  front: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', backgroundColor: colors.canvas },
  weaponCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  discount: { position: 'absolute', top: 0, left: 0, flexDirection: 'row' },
  discountBody: { height: DISCOUNT_H, paddingLeft: space.sm, paddingRight: 2, justifyContent: 'center', backgroundColor: colors.accent },
  discountText: { fontSize: 12, letterSpacing: 0.2 },
  discountTip: {
    width: 0,
    height: 0,
    borderTopWidth: DISCOUNT_H,
    borderRightWidth: DISCOUNT_H * 0.6,
    borderTopColor: colors.accent,
    borderRightColor: 'transparent',
  },
  prices: { position: 'absolute', top: space.xs, right: space.sm, alignItems: 'flex-end' },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  finalPrice: { fontSize: 15, lineHeight: 19 },
  strike: { textDecorationLine: 'line-through', fontSize: 11 },
  // Margens iguais dos dois lados, largas o bastante para não encostar no coração (29 pt + respiro).
  nameBox: { position: 'absolute', left: 38, right: 38, bottom: space.md, alignItems: 'center' },
  heart: { position: 'absolute', right: space.xs, bottom: space.xs },
  name: { textAlign: 'center', letterSpacing: 0.6, fontSize: 12, lineHeight: 16 },
});
