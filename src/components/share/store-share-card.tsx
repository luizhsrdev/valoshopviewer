import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatLongDate, formatNumber } from '@/lib/format';
import type { Shop } from '@/lib/shop';
import { colors, radius, rarityFallback, space, withAlpha } from '@/theme';

import { Text } from '../text';

type Props = {
  shop: Shop;
  who: string;
  onReady?(): void;
};

/** Cartão "Minha loja de hoje": pacote em destaque + as 4 ofertas do dia. */
export function StoreShareCard({ shop, who, onReady }: Props) {
  const bundle = shop.bundles[0] ?? null;
  const expected = useMemo(
    () => (bundle?.image ? 1 : 0) + shop.daily.offers.filter((o) => o.image).length,
    [bundle, shop.daily.offers],
  );
  const [loaded, setLoaded] = useState(0);
  const ready = loaded >= expected;
  const bump = () => setLoaded((n) => n + 1);

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  return (
    <View style={styles.card}>
      <LinearGradient colors={[colors.surfaceCard, colors.canvas]} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text variant="micro" color={colors.accent} style={styles.kicker}>
          MINHA LOJA DE HOJE
        </Text>
        <Text variant="title" color={colors.ink} numberOfLines={1}>
          {who}
        </Text>
        <Text variant="caption" color={colors.ash}>
          {formatLongDate(shop.fetchedAt)}
        </Text>
      </View>

      {bundle ? (
        <View style={styles.bundle}>
          <View style={styles.bundleImageBox}>
            <Image
              source={bundle.image ?? undefined}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={bump}
              onError={bump}
            />
            <LinearGradient colors={['transparent', colors.surfaceCard]} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
          </View>
          <View style={styles.bundleMeta}>
            <Text variant="micro" color={colors.mute}>
              PACOTE EM DESTAQUE
            </Text>
            <Text variant="bodyStrong" color={colors.ink}>
              {bundle.name}
            </Text>
            <View style={styles.priceRow}>
              <Text variant="numeric" color={colors.ink}>
                {formatNumber(bundle.price)}
              </Text>
              <Text variant="caption" color={colors.mute}>
                VP
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.grid}>
        {shop.daily.offers.map((o) => (
          <View key={o.id} style={[styles.offer, { borderColor: o.tier ? withAlpha(o.tier.color, 0.6) : rarityFallback }]}>
            {o.tier ? <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(o.tier.color, 0.08) }]} /> : null}
            <View style={styles.offerImageBox}>
              <Image
                source={o.image ?? undefined}
                style={styles.offerImage}
                contentFit="contain"
                cachePolicy="memory-disk"
                onLoad={bump}
                onError={bump}
              />
            </View>
            <Text variant="caption" color={colors.ink} style={styles.offerName}>
              {o.name}
            </Text>
            <Text variant="micro" color={colors.mute}>
              {formatNumber(o.price)} VP
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Image source={require('@/assets/images/icon.png')} style={styles.badge} />
        <Text variant="caption" color={colors.ash}>
          Minha Loja
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sem altura fixa: o cartão cresce com o conteúdo, então nada fica cortado
  // (nome grande, mais itens...) — quem rola é o painel em volta, não o cartão.
  card: { width: '100%', padding: space.lg, gap: space.md },
  header: { gap: 2 },
  kicker: { letterSpacing: 1.2 },
  bundle: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceCard, borderWidth: 1, borderColor: colors.hairline },
  bundleImageBox: { aspectRatio: 16 / 9, backgroundColor: colors.surfaceElevated },
  bundleMeta: { padding: space.md, paddingTop: space.xs, gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  offer: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surfaceCard,
    padding: space.sm,
    gap: 2,
    overflow: 'hidden',
  },
  // Proporção fixa só na imagem (não na célula inteira): garante que ela
  // sempre tenha um tamanho pra carregar, mesmo com o nome ocupando 2+ linhas.
  offerImageBox: { aspectRatio: 1.5, alignItems: 'center', justifyContent: 'center' },
  offerImage: { width: '90%', height: '90%' },
  offerName: { marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'center', marginTop: space.xs },
  badge: { width: 16, height: 16, borderRadius: 4 },
});
