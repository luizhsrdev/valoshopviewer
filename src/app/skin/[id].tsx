import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { VideoPlayer } from '@/components/skin/video-player';
import { ZoomableImage } from '@/components/skin/zoomable-image';
import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { formatNumber } from '@/lib/format';
import { loadSkinDetail, type SkinDetail } from '@/lib/skin-detail';
import { colors, radius, space, withAlpha } from '@/theme';

type Hero = { kind: 'image' } | { kind: 'video'; uri: string; key: string };

export default function SkinScreen() {
  const params = useLocalSearchParams<{ id: string; price?: string; base?: string; discount?: string }>();
  const [detail, setDetail] = useState<SkinDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState(0);
  const [hero, setHero] = useState<Hero>({ kind: 'image' });

  const load = useCallback(
    () =>
      loadSkinDetail(params.id)
        .then(setDetail)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Não foi possível carregar os detalhes.')),
    [params.id],
  );
  const retry = () => {
    setError(null);
    load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const tint = detail?.tier?.color ?? colors.mute;
  const current = detail?.variants[variant];
  const price = Number(params.price) || null;
  const base = Number(params.base) || null;
  const discount = Number(params.discount) || null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar detalhes">
          <Text variant="label" color={colors.mute}>
            ✕ Fechar
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <LinearGradient
            colors={[withAlpha(tint, 0.22), withAlpha(tint, 0.04), colors.surface]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          {!detail ? (
            error ? null : <Skeleton height="100%" radius={0} />
          ) : hero.kind === 'video' ? (
            <VideoPlayer key={hero.key} uri={hero.uri} tint={tint} />
          ) : (
            <ZoomableImage uri={current?.image ?? null} />
          )}
        </View>
        {detail && hero.kind === 'image' ? (
          <Text variant="caption" color={colors.ash} style={styles.hint}>
            Use a pinça ou toque duas vezes para ampliar.
          </Text>
        ) : null}
        {hero.kind === 'video' ? (
          <Pressable onPress={() => setHero({ kind: 'image' })} hitSlop={8} style={styles.hintBtn} accessibilityRole="button">
            <Text variant="label" color={colors.ink}>
              Voltar para a imagem
            </Text>
          </Pressable>
        ) : null}

        {error ? (
          <View style={styles.error}>
            <Text color={colors.body}>{error}</Text>
            <Button label="Tentar de novo" onPress={retry} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}

        {detail ? (
          <>
            <View style={styles.titleBlock}>
              <Text variant="display" color={colors.ink}>
                {detail.name}
              </Text>
              {price ? (
                <View style={styles.priceRow}>
                  <Text variant="numeric" color={colors.ink} style={styles.price}>
                    {formatNumber(price)}
                  </Text>
                  <Text variant="caption" color={colors.mute}>
                    VP
                  </Text>
                  {base && base > price ? (
                    <Text variant="caption" color={colors.ash} style={styles.strike}>
                      {formatNumber(base)}
                    </Text>
                  ) : null}
                  {discount ? (
                    <View style={[styles.badge, { backgroundColor: withAlpha(tint, 0.2), borderColor: withAlpha(tint, 0.5) }]}>
                      <Text variant="micro" color={tint}>
                        −{discount}%
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {detail.variants.length > 1 ? (
              <Section title="Variantes">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variants}>
                  {detail.variants.map((v, i) => {
                    const selected = i === variant;
                    return (
                      <Pressable
                        key={v.uuid}
                        onPress={() => {
                          setVariant(i);
                          setHero({ kind: 'image' });
                        }}
                        style={styles.variant}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Variante ${v.label}`}>
                        <View style={[styles.swatch, { borderColor: selected ? colors.ink : colors.hairline }]}>
                          {v.swatch ? (
                            <Image source={v.swatch} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
                          ) : (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceElevated }]} />
                          )}
                        </View>
                        <Text variant="caption" color={selected ? colors.ink : colors.mute} numberOfLines={1} style={styles.variantLabel}>
                          {v.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {current?.video ? (
                  <Button
                    kind="ghost"
                    label={`Ver vídeo · ${current.label}`}
                    onPress={() => setHero({ kind: 'video', uri: current.video!, key: current.uuid })}
                  />
                ) : null}
              </Section>
            ) : null}

            {detail.levels.length > 1 ? (
              <Section title="Níveis">
                <View style={styles.levels}>
                  {detail.levels.map((l, i) => {
                    const playing = hero.kind === 'video' && hero.key === l.uuid;
                    const row = (
                      <View style={[styles.level, i > 0 && styles.levelDivider, playing && { backgroundColor: colors.surfaceElevated }]}>
                        <Text variant="caption" color={colors.ash} style={styles.levelNumber}>
                          Nível {l.number}
                        </Text>
                        <Text variant="label" color={colors.ink} style={{ flex: 1 }}>
                          {l.label}
                        </Text>
                        {l.video ? (
                          <Text variant="caption" color={playing ? tint : colors.mute}>
                            {playing ? 'Tocando' : '▶ Vídeo'}
                          </Text>
                        ) : null}
                      </View>
                    );
                    return l.video ? (
                      <Pressable
                        key={l.uuid}
                        onPress={() => setHero({ kind: 'video', uri: l.video!, key: l.uuid })}
                        accessibilityRole="button"
                        accessibilityLabel={`Nível ${l.number}, ${l.label}. Ver vídeo.`}>
                        {row}
                      </Pressable>
                    ) : (
                      <View key={l.uuid}>{row}</View>
                    );
                  })}
                </View>
              </Section>
            ) : null}
          </>
        ) : !error ? (
          <View style={{ gap: space.sm }}>
            <Skeleton width="70%" height={28} />
            <Skeleton width="30%" height={16} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  hero: {
    aspectRatio: 1.5,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  hint: { textAlign: 'center', marginTop: -space.sm },
  hintBtn: { alignSelf: 'center', marginTop: -space.sm, paddingVertical: space.xs },
  error: { gap: space.md },
  titleBlock: { gap: space.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  price: { fontSize: 20, lineHeight: 26 },
  strike: { textDecorationLine: 'line-through' },
  badge: { borderRadius: radius.xs, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  section: { gap: space.md, marginTop: space.sm },
  variants: { gap: space.md },
  variant: { width: 64, alignItems: 'center', gap: space.xs },
  swatch: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 2, overflow: 'hidden' },
  variantLabel: { textAlign: 'center' },
  levels: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden', backgroundColor: colors.surface },
  level: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52 },
  levelDivider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  levelNumber: { width: 52 },
});
