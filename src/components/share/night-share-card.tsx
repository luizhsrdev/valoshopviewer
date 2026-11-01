import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDate, formatNumber } from '@/lib/format';
import type { Shop } from '@/lib/shop';
import { colors, radius, rarityFallback, space, withAlpha } from '@/theme';

import { Text } from '../text';

type Props = {
  night: NonNullable<Shop['night']>;
  who: string;
  onReady?(): void;
};

/** Cartão "Meu mercado noturno": as skins do mercado, com desconto. */
export function NightShareCard({ night, who, onReady }: Props) {
  const expected = useMemo(() => night.offers.filter((o) => o.image).length, [night.offers]);
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
          MEU MERCADO NOTURNO
        </Text>
        <Text variant="title" color={colors.ink} numberOfLines={1}>
          {who}
        </Text>
        <Text variant="caption" color={colors.ash}>
          {night.startedAt ? `${formatDate(night.startedAt)} - ` : 'até '}
          {formatDate(night.endsAt)}
        </Text>
      </View>

      <View style={styles.grid}>
        {night.offers.map((o) => (
          <View key={o.id} style={[styles.offer, { borderColor: o.tier ? withAlpha(o.tier.color, 0.6) : rarityFallback }]}>
            {o.tier ? <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(o.tier.color, 0.08) }]} /> : null}
            <View style={styles.discount}>
              <Text variant="micro" color={colors.onAccent}>
                −{o.discountPercent}%
              </Text>
            </View>
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
            <View style={styles.priceRow}>
              <Text variant="micro" color={colors.ink}>
                {formatNumber(o.finalPrice)} VP
              </Text>
              <Text variant="micro" color={colors.ash} style={styles.strike}>
                {formatNumber(o.basePrice)}
              </Text>
            </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  offer: {
    flexBasis: '31%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surfaceCard,
    padding: space.xs,
    gap: 1,
    overflow: 'hidden',
  },
  discount: {
    position: 'absolute',
    top: space.xs,
    left: space.xs,
    zIndex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  // Proporção fixa só na imagem (não na célula inteira): garante que ela
  // sempre tenha um tamanho pra carregar, mesmo com o nome ocupando 2+ linhas.
  offerImageBox: { aspectRatio: 1.3, alignItems: 'center', justifyContent: 'center' },
  offerImage: { width: '85%', height: '85%' },
  offerName: { marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' },
  strike: { textDecorationLine: 'line-through' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'center', marginTop: space.xs },
  badge: { width: 16, height: 16, borderRadius: 4 },
});
