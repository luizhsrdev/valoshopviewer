import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Countdown } from '@/components/countdown';
import { OfferCard, OfferCardSkeleton } from '@/components/store/offer-card';
import { Text } from '@/components/text';
import { KIND_LABEL, resolveBundleItems, type ResolvedBundleItem } from '@/lib/bundle-detail';
import { formatNumber } from '@/lib/format';
import { openSkin } from '@/lib/skin-detail';
import { useShop } from '@/providers/shop';
import { colors, radius, space } from '@/theme';

export default function PacoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shop } = useShop();
  const bundle = shop?.bundles.find((b) => b.id === id) ?? null;

  const [items, setItems] = useState<ResolvedBundleItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!bundle) return;
    resolveBundleItems(bundle.items)
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Não foi possível carregar os itens.'));
  }, [bundle]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setError(null);
    load();
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const skins = items?.filter((i) => i.kind === 'skin') ?? [];
  const others = items?.filter((i) => i.kind !== 'skin') ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar para a loja">
          <Text variant="label" color={colors.mute}>
            ‹ Loja
          </Text>
        </Pressable>
      </View>

      {!bundle ? (
        <View style={[styles.content, styles.empty]}>
          <Text variant="heading" color={colors.ink}>
            Este pacote não está mais na loja
          </Text>
          <Button label="Voltar para a loja" onPress={back} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Image source={bundle.image ?? undefined} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
            <LinearGradient colors={['transparent', colors.canvas]} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
          </View>

          <View style={styles.titleBlock}>
            <Text variant="micro" color={colors.mute}>
              PACOTE EM DESTAQUE
            </Text>
            <Text variant="display" color={colors.ink}>
              {bundle.name}
            </Text>
            <View style={styles.priceRow}>
              <Text variant="numeric" color={colors.ink} style={styles.price}>
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
              <View style={styles.pill}>
                <Countdown to={bundle.endsAt} prefix="termina em " variant="caption" color={colors.mute} />
              </View>
            </View>
          </View>

          {error ? (
            <View style={styles.empty}>
              <Text color={colors.body}>{error}</Text>
              <Button label="Tentar de novo" onPress={retry} style={{ alignSelf: 'flex-start' }} />
            </View>
          ) : !items ? (
            <Grid>
              {[0, 1, 2, 3].map((i) => (
                <OfferCardSkeleton key={i} />
              ))}
            </Grid>
          ) : (
            <>
              {skins.length ? (
                <Section title={`Skins · ${skins.length}`}>
                  <Grid>
                    {skins.map((it) => (
                      <OfferCard
                        key={it.key}
                        offer={{ id: it.key, skinUuid: it.skinUuid, name: it.name, image: it.image, price: it.price, tier: it.tier }}
                        onPress={
                          it.skinUuid
                            ? () => openSkin(it.skinUuid, { price: it.price, basePrice: it.basePrice > it.price ? it.basePrice : undefined })
                            : undefined
                        }
                      />
                    ))}
                  </Grid>
                </Section>
              ) : null}

              {others.length ? (
                <Section title="Também vem no pacote">
                  <View style={styles.list}>
                    {others.map((it, i) => (
                      <View key={it.key} style={[styles.row, i > 0 && styles.rowDivider]}>
                        <View style={styles.thumb}>
                          {it.image ? (
                            <Image source={it.image} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" />
                          ) : (
                            <Text variant="micro" color={colors.ash}>
                              Aa
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text variant="label" color={colors.ink} numberOfLines={2}>
                            {it.name}
                          </Text>
                          <Text variant="caption" color={colors.ash}>
                            {KIND_LABEL[it.kind]}
                          </Text>
                        </View>
                        <Text variant="numeric" color={it.price ? colors.body : colors.mute} style={styles.rowPrice}>
                          {it.price ? `${formatNumber(it.price)} VP` : 'Incluso'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Section>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Grade de 2 colunas, como as ofertas do dia. */
function Grid({ children }: { children: React.ReactNode[] }) {
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < children.length; i += 2) rows.push(children.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" color={colors.ink}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { height: 48, justifyContent: 'center', paddingHorizontal: space.lg },
  content: { padding: space.lg, paddingTop: 0, gap: space.lg, paddingBottom: space.section },
  empty: { gap: space.md },
  hero: {
    aspectRatio: 16 / 9,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceElevated,
  },
  titleBlock: { gap: space.xs, marginTop: -space.xl, paddingHorizontal: space.xs },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, flexWrap: 'wrap' },
  price: { fontSize: 20, lineHeight: 26 },
  strike: { textDecorationLine: 'line-through', marginLeft: space.xs },
  pill: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: 2,
  },
  section: { gap: space.md, marginTop: space.sm },
  grid: { gap: space.md },
  gridRow: { flexDirection: 'row', gap: space.md },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden', backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowPrice: { fontSize: 13 },
});
