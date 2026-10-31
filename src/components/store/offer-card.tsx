import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatNumber } from '@/lib/format';
import type { SkinOffer } from '@/lib/shop';
import { colors, radius, rarityFallback, rarityGlow, space, withAlpha } from '@/theme';

import { Skeleton } from '../skeleton';
import { WishHeart } from '../wish-heart';
import { Text } from '../text';

export function OfferCard({ offer, onPress }: { offer: SkinOffer; onPress?(): void }) {
  const color = offer.tier?.color;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        color ? rarityGlow(color) : { borderWidth: 1, borderColor: rarityFallback },
        pressed && { backgroundColor: colors.surfacePressed },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${offer.name}, ${formatNumber(offer.price)} VP. Toque para ver os detalhes.`}>
      <View style={styles.imageBox}>
        {color ? <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(color, 0.06) }]} /> : null}
        <Image
          source={offer.image ?? undefined}
          style={styles.image}
          contentFit="contain"
          transition={200}
          cachePolicy="memory-disk"
        />
      </View>
      <Text variant="label" color={colors.ink} numberOfLines={1}>
        {offer.name}
      </Text>
      <Text variant="numeric" color={colors.body} style={styles.price}>
        {formatNumber(offer.price)} VP
      </Text>
      <WishHeart skinUuid={offer.skinUuid} name={offer.name} size={16} style={styles.heart} />
    </Pressable>
  );
}

export function OfferCardSkeleton() {
  return (
    <View style={[styles.card, { borderWidth: 1, borderColor: colors.hairline }]}>
      <Skeleton height={undefined} style={styles.imageBox} radius={radius.sm} />
      <Skeleton width="75%" height={12} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  imageBox: {
    aspectRatio: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '88%', height: '80%' },
  price: { fontSize: 13 },
  heart: { position: 'absolute', top: space.xs, right: space.xs },
});
