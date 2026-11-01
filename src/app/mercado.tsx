import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlertDialog } from '@/components/alert-dialog';
import { Button } from '@/components/button';
import { Countdown, useNow } from '@/components/countdown';
import { NightCard } from '@/components/night-market/night-card';
import { NightShareCard } from '@/components/share/night-share-card';
import { ShareSheet } from '@/components/share/share-sheet';
import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { formatDate } from '@/lib/format';
import { markNightSeen, readRevealed, saveRevealed } from '@/lib/night-market';
import { playerLabel } from '@/lib/riot/session';
import { openSkin } from '@/lib/skin-detail';
import { activeNight, type NightOffer } from '@/lib/shop';
import { useSession } from '@/providers/session';
import { useShop } from '@/providers/shop';
import { colors, radius, space } from '@/theme';

export default function Mercado() {
  const { account, demo } = useSession();
  const { shop, loading } = useShop();
  const now = useNow(30_000);
  const night = activeNight(shop, now);
  const reduced = useReducedMotion();
  const who = playerLabel(account, !!demo?.enabled);

  const [sharing, setSharing] = useState(false);
  const [shareReady, setShareReady] = useState(false);
  const [needsReveal, setNeedsReveal] = useState(false);

  // null = ainda lendo do armazenamento (evita piscar o verso das cartas).
  const [revealed, setRevealed] = useState<Set<string> | null>(null);
  // Cartas que já estavam reveladas ao abrir: aparecem sem animação.
  const [initial, setInitial] = useState<Set<string>>(() => new Set());

  const marketEndsAt = night?.endsAt;
  // Primeiro acesso a este mercado: o ícone da loja perde o ponto vermelho.
  useEffect(() => {
    if (night) markNightSeen(night);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketEndsAt]);

  useEffect(() => {
    if (!marketEndsAt) return;
    let alive = true;
    readRevealed().then((set) => {
      if (!alive) return;
      setInitial(new Set(set));
      setRevealed(set);
    });
    return () => {
      alive = false;
    };
  }, [marketEndsAt]);

  // Baixa as imagens antes da revelação para a animação não esperar a rede.
  useEffect(() => {
    const urls = night?.offers.map((o) => o.image).filter((u): u is string => !!u) ?? [];
    if (urls.length) Image.prefetch(urls, 'disk').catch(() => {});
  }, [night]);

  const reveal = useCallback(
    (id: string) => {
      if (!night) return;
      setRevealed((prev) => {
        const next = new Set(prev ?? []);
        next.add(id);
        saveRevealed(next, night.endsAt);
        return next;
      });
    },
    [night],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const openShare = () => {
    if (!night || !revealed) return;
    if (!night.offers.every((o) => revealed.has(o.id))) {
      setNeedsReveal(true);
      return;
    }
    setShareReady(false);
    setSharing(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar para a loja">
          <Text variant="label" color={colors.mute}>
            ‹ Loja
          </Text>
        </Pressable>
        {night ? (
          <Pressable
            onPress={openShare}
            hitSlop={8}
            style={({ pressed }) => [styles.shareButton, pressed && { backgroundColor: colors.surfaceElevated }]}
            accessibilityRole="button"
            accessibilityLabel="Compartilhar o mercado noturno">
            <Ionicons name="share-social-outline" size={19} color={colors.mute} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View style={{ gap: 2, flex: 1 }}>
            <Text variant="title" color={colors.ink}>
              Mercado noturno
            </Text>
            {night ? (
              <Text
                variant="numeric"
                color={colors.ash}
                style={styles.period}
                accessibilityLabel={`De ${formatDate(night.startedAt ?? night.endsAt)} a ${formatDate(night.endsAt)}`}>
                {night.startedAt ? `${formatDate(night.startedAt)} - ` : 'até '}
                {formatDate(night.endsAt)}
              </Text>
            ) : null}
          </View>
          {night ? (
            <View style={styles.timer}>
              <Text variant="micro" color={colors.ash}>
                TERMINA EM
              </Text>
              <Countdown to={night.endsAt} color={colors.accent} />
            </View>
          ) : null}
        </View>

        {night && revealed ? (
          <Cards offers={night.offers} revealed={revealed} initial={initial} reduced={reduced} onReveal={reveal} />
        ) : !night && !loading ? (
          <View style={styles.empty}>
            <Text variant="heading" color={colors.ink}>
              O mercado noturno não está aberto
            </Text>
            <Text color={colors.mute}>
              Quando ele abrir, a loja mostra um aviso e você recebe uma notificação.
            </Text>
            <Button label="Voltar para a loja" onPress={back} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : (
          <CardsSkeleton />
        )}
      </ScrollView>

      <AlertDialog
        visible={needsReveal}
        title="Revele todas as cartas"
        message="Para compartilhar o mercado noturno, toque em cada carta para revelar antes."
        buttons={[{ text: 'OK' }]}
        onRequestClose={() => setNeedsReveal(false)}
      />

      {sharing && night ? (
        <ShareSheet
          title="Compartilhar mercado"
          dialogTitle="Meu mercado noturno"
          ready={shareReady}
          onClose={() => setSharing(false)}>
          <NightShareCard night={night} who={who} onReady={() => setShareReady(true)} />
        </ShareSheet>
      ) : null}
    </SafeAreaView>
  );
}

const openOffer = (o: NightOffer) =>
  openSkin(o.skinUuid, { price: o.finalPrice, basePrice: o.basePrice, discountPercent: o.discountPercent });

function Cards({
  offers,
  revealed,
  initial,
  reduced,
  onReveal,
}: {
  offers: NightOffer[];
  revealed: Set<string>;
  initial: Set<string>;
  reduced: boolean;
  onReveal(id: string): void;
}) {
  const rows: NightOffer[][] = [];
  for (let i = 0; i < offers.length; i += 2) rows.push(offers.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((o, c) => (
            <NightCard
              key={o.id}
              offer={o}
              index={r * 2 + c}
              revealed={revealed.has(o.id)}
              instant={reduced || initial.has(o.id)}
              onReveal={onReveal}
              onOpen={openOffer}
            />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function CardsSkeleton() {
  return (
    <View style={styles.grid}>
      {[0, 1, 2].map((r) => (
        <View key={r} style={styles.row}>
          <Skeleton height={undefined} radius={radius.lg} style={{ flex: 1, aspectRatio: 0.68 }} />
          <Skeleton height={undefined} radius={radius.lg} style={{ flex: 1, aspectRatio: 0.68 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  shareButton: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  content: { padding: space.lg, paddingTop: 0, gap: space.xl, paddingBottom: space.section },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  timer: { alignItems: 'flex-end', gap: 2 },
  period: { fontSize: 13 },
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  empty: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
});
