import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Countdown, useNow } from '@/components/countdown';
import { ShareSheet } from '@/components/share/share-sheet';
import { StoreShareCard } from '@/components/share/store-share-card';
import { Skeleton } from '@/components/skeleton';
import { BundleCarousel } from '@/components/store/bundle-carousel';
import { DevPanel } from '@/components/store/dev-panel';
import { NightMarketCallout } from '@/components/store/night-market-callout';
import { OfferCard, OfferCardSkeleton } from '@/components/store/offer-card';
import { Wallet } from '@/components/store/wallet';
import { Text } from '@/components/text';
import { formatTime } from '@/lib/format';
import { markNightCallout, marketKey, shouldShowNightCallout, wasNightSeen } from '@/lib/night-market';
import { playerLabel } from '@/lib/riot/session';
import { openSkin } from '@/lib/skin-detail';
import { activeNight, type SkinOffer } from '@/lib/shop';
import { useSession } from '@/providers/session';
import { useShop } from '@/providers/shop';
import { useWishlist } from '@/providers/wishlist';
import { colors, radius, space, withAlpha } from '@/theme';

const NIGHT_CALLOUT_EVERY = 6 * 3_600_000;

export default function Loja() {
  const { account, demo } = useSession();
  const { ids: wishlist } = useWishlist();
  const { shop, loading, refreshing, error, refresh } = useShop();
  // Reavalia a cada 30 s se o mercado ainda está valendo.
  const now = useNow(30_000);
  const night = activeNight(shop, now);

  // Balão apontando para o ícone do mercado: num mercado novo e, depois, no
  // máximo a cada 6 h, sempre que a loja aparece.
  const focused = useIsFocused();
  // hidden → open → closing (anima de volta para o ícone) → hidden.
  const [callout, setCallout] = useState<'hidden' | 'open' | 'closing'>('hidden');
  const [iconsWidth, setIconsWidth] = useState(0);
  const [nightIconCenter, setNightIconCenter] = useState(0);
  const showCallout = () => setCallout('open');
  const hideCallout = () => setCallout((c) => (c === 'open' ? 'closing' : c));
  // Tocar fora fecha o balão: o toque dentro dele marca esta flag antes de
  // chegar à tela (os eventos sobem do filho para o pai).
  const touchInCallout = useRef(false);
  const onScreenTouch = () => {
    if (touchInCallout.current) {
      touchInCallout.current = false;
      return;
    }
    if (callout === 'open') hideCallout();
  };
  const nightKey = night ? marketKey(night) : null;
  // Ponto vermelho no ícone até o primeiro acesso a este mercado.
  const [nightSeen, setNightSeen] = useState(true);
  useEffect(() => {
    if (!focused || !night) return;
    let alive = true;
    wasNightSeen(night).then((seen) => alive && setNightSeen(seen));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, nightKey]);
  useEffect(() => {
    if (!focused || !night) return;
    let alive = true;
    shouldShowNightCallout(night, NIGHT_CALLOUT_EVERY).then((show) => {
      if (!alive || !show) return;
      showCallout();
      markNightCallout(night);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, nightKey]);

  const who = playerLabel(account, !!demo?.enabled);

  const [sharing, setSharing] = useState(false);
  const [shareReady, setShareReady] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top']} onTouchStart={onScreenTouch}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surfaceElevated}
          />
        }>
        <View style={styles.top}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" color={colors.ink}>
              Loja
            </Text>
            <Text variant="caption" color={colors.ash} numberOfLines={1}>
              {who}
            </Text>
          </View>
          <View style={styles.topRight}>
            <View style={styles.icons} onLayout={(e) => setIconsWidth(e.nativeEvent.layout.width)}>
              {night ? (
                <Pressable
                  onLayout={(e) => setNightIconCenter(e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2)}
                  onPress={() => {
                    hideCallout();
                    router.push('/mercado');
                  }}
                  onLongPress={showCallout}
                  delayLongPress={350}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.surfaceElevated }]}
                  accessibilityRole="button"
                  accessibilityLabel={nightSeen ? 'Mercado noturno' : 'Mercado noturno, novo'}
                  accessibilityHint="Segure para ver quanto tempo falta">
                  <Image source={require('@/assets/images/night-market.png')} style={styles.nightIcon} tintColor={colors.mute} />
                  {/* Ponto vermelho: mercado novo, ainda não aberto. */}
                  {nightSeen ? null : <View style={styles.nightDot} />}
                </Pressable>
              ) : null}
              <HeaderIcon
                name={wishlist.size ? 'heart' : 'heart-outline'}
                label={`Lista de desejos, ${wishlist.size} skins`}
                onPress={() => router.push('/desejos')}
              />
              {shop ? (
                <HeaderIcon
                  name="share-social-outline"
                  label="Compartilhar a loja de hoje"
                  onPress={() => {
                    setShareReady(false);
                    setSharing(true);
                  }}
                />
              ) : null}
              <HeaderIcon name="settings-outline" label="Configurações" onPress={() => router.push('/configuracoes')} />
              {night && callout !== 'hidden' ? (
                <NightMarketCallout
                  open={callout === 'open'}
                  onClosed={() => setCallout('hidden')}
                  endsAt={night.endsAt}
                  // A fileira de ícones sai space.sm pela direita; o balão fica alinhado à margem.
                  arrowRight={iconsWidth - nightIconCenter - space.sm}
                  onPress={() => {
                    hideCallout();
                    router.push('/mercado');
                  }}
                  onDismiss={hideCallout}
                  onTouchInside={() => (touchInCallout.current = true)}
                />
              ) : null}
            </View>
            {shop ? <Wallet wallet={shop.wallet} /> : <Skeleton width={140} height={14} />}
          </View>
        </View>

        {error && shop ? (
          <View style={styles.staleBar}>
            <Text variant="caption" color={colors.body} style={{ flex: 1 }}>
              Não foi possível atualizar. Mostrando a loja das {formatTime(shop.fetchedAt)}.
            </Text>
            <Pressable onPress={refresh} hitSlop={10} accessibilityRole="button">
              <Text variant="label" color={colors.ink}>
                Tentar de novo
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <StoreSkeleton />
        ) : !shop ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (
          <>
            <BundleCarousel bundles={shop.bundles} />
            <View style={styles.sectionHead}>
              <Text variant="heading" color={colors.ink}>
                Ofertas do dia
              </Text>
              <Countdown to={shop.daily.endsAt} color={colors.accent} accessibilityLabel="Tempo até a troca da loja" />
            </View>
            <Grid offers={shop.daily.offers} />
          </>
        )}

        {__DEV__ ? <DevPanel onShowNightCallout={showCallout} /> : null}
      </ScrollView>

      {sharing && shop ? (
        <ShareSheet
          title="Compartilhar loja"
          dialogTitle="Minha loja de hoje"
          ready={shareReady}
          onClose={() => setSharing(false)}>
          <StoreShareCard shop={shop} who={who} onReady={() => setShareReady(true)} />
        </ShareSheet>
      ) : null}
    </SafeAreaView>
  );
}

function HeaderIcon({ name, label, onPress }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.surfaceElevated }]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name={name} size={19} color={colors.mute} />
    </Pressable>
  );
}

function Grid({ offers }: { offers: SkinOffer[] }) {
  const rows = [offers.slice(0, 2), offers.slice(2, 4)];
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((o) => (
            <OfferCard key={o.id} offer={o} onPress={o.skinUuid ? () => openSkin(o.skinUuid, { price: o.price }) : undefined} />
          ))}
        </View>
      ))}
    </View>
  );
}

function StoreSkeleton() {
  return (
    <View style={{ gap: space.lg }} accessibilityLabel="Carregando a loja">
      <View style={styles.heroSkeleton}>
        <Skeleton height={undefined} radius={0} style={{ aspectRatio: 16 / 9 }} />
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Skeleton width="30%" height={10} />
          <Skeleton width="65%" height={24} />
          <Skeleton width="40%" height={14} />
        </View>
      </View>
      <View style={styles.sectionHead}>
        <Skeleton width={120} height={16} />
        <Skeleton width={70} height={16} />
      </View>
      <View style={styles.grid}>
        <View style={styles.row}>
          <OfferCardSkeleton />
          <OfferCardSkeleton />
        </View>
        <View style={styles.row}>
          <OfferCardSkeleton />
          <OfferCardSkeleton />
        </View>
      </View>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry(): void }) {
  return (
    <View style={styles.error}>
      <Text variant="heading" color={colors.ink}>
        A loja não carregou
      </Text>
      <Text color={colors.mute}>{message ?? 'Verifique sua internet e tente de novo.'}</Text>
      <Button label="Tentar de novo" onPress={onRetry} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.section },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, zIndex: 10 },
  topRight: { alignItems: 'flex-end', gap: space.sm },
  icons: { flexDirection: 'row', gap: space.xs, marginRight: -space.sm },
  nightIcon: { width: 21, height: 21 },
  nightDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.canvas,
  },
  iconButton: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  staleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.35),
    backgroundColor: colors.dangerSoft,
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.sm },
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  heroSkeleton: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceCard,
  },
  error: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
});
