import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { formatNumber } from '@/lib/format';
import type { FeaturedBundle } from '@/lib/shop';
import { colors, radius, space } from '@/theme';

import { Countdown } from '../countdown';
import { Text } from '../text';

const GAP = space.md;

export function BundleCarousel({ bundles }: { bundles: FeaturedBundle[] }) {
  const { width: screen } = useWindowDimensions();
  const width = screen - space.lg * 2;
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x / (width + GAP);
  });

  if (bundles.length === 0) return null;
  if (bundles.length === 1) return <BundleCard bundle={bundles[0]!} width={width} />;

  return (
    <View style={{ gap: space.md }}>
      <Animated.FlatList
        data={bundles}
        keyExtractor={(b) => b.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={width + GAP}
        decelerationRate="fast"
        disableIntervalMomentum
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ marginHorizontal: -space.lg }}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: GAP }}
        renderItem={({ item }) => <BundleCard bundle={item} width={width} />}
      />
      <View style={styles.dots} accessibilityElementsHidden>
        {bundles.map((b, i) => (
          <Dot key={b.id} index={i} progress={scrollX} />
        ))}
      </View>
    </View>
  );
}

function Dot({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(Math.abs(progress.value - index), [0, 1], [1, 0], 'clamp');
    return {
      width: 6 + t * 12,
      backgroundColor: t > 0.5 ? colors.accent : colors.hairlineStrong,
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

function BundleCard({ bundle, width }: { bundle: FeaturedBundle; width: number }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/pacote/[id]', params: { id: bundle.id } })}
      style={({ pressed }) => [styles.card, { width }, pressed && { borderColor: colors.hairlineStrong }]}
      accessibilityRole="button"
      accessibilityLabel={`Pacote ${bundle.name}, ${formatNumber(bundle.price)} VP. Toque para ver os itens.`}>
      <View style={styles.imageBox}>
        <Image
          source={bundle.image ?? undefined}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          // É a maior imagem da tela, logo no topo: decodifica antes das outras.
          priority="high"
        />
        <LinearGradient
          colors={['transparent', colors.surfaceCard]}
          locations={[0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.meta}>
        <Text variant="micro" color={colors.mute}>
          PACOTE EM DESTAQUE
        </Text>
        <Text variant="display" color={colors.ink} numberOfLines={2}>
          {bundle.name}
        </Text>
        <View style={styles.row}>
          <View style={styles.price}>
            <Text variant="numeric" color={colors.ink} style={styles.priceValue}>
              {formatNumber(bundle.price)}
            </Text>
            <Text variant="caption" color={colors.mute}>
              VP
            </Text>
            {bundle.basePrice ? (
              <Text variant="caption" color={colors.ash} style={styles.strike}>
                {formatNumber(bundle.basePrice)}
              </Text>
            ) : null}
          </View>
          <View style={styles.pill}>
            <Countdown to={bundle.endsAt} prefix="termina em " variant="caption" color={colors.mute} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  imageBox: { aspectRatio: 16 / 9, backgroundColor: colors.surfaceElevated },
  meta: { padding: space.lg, paddingTop: 0, marginTop: -space.xl, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.xs },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  priceValue: { fontSize: 17 },
  strike: { textDecorationLine: 'line-through', marginLeft: space.xs },
  pill: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: 2,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
});
