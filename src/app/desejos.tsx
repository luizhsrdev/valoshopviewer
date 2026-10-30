import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { WeaponSorter } from '@/components/weapon-sorter';
import { WishHeart } from '@/components/wish-heart';
import { loadContent, type Content } from '@/lib/content';
import { activeNight } from '@/lib/shop';
import { openSkin } from '@/lib/skin-detail';
import { fold } from '@/lib/text';
import { applyWeaponPrefs, readWeaponPrefs, writeWeaponPrefs, type WeaponPrefs } from '@/lib/weapon-order';
import { useShop } from '@/providers/shop';
import { useWishlist } from '@/providers/wishlist';
import { colors, radius, space, type as typeScale } from '@/theme';

type Row = { uuid: string; name: string; image: string | null; weapon: string; color: string | null; search: string };

const ROW_H = 68;

const MELEE_LABEL = 'Corpo a corpo';

export default function Desejos() {
  const { ids } = useWishlist();
  const { shop } = useShop();
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'catalog'>(ids.size ? 'list' : 'catalog');
  const [query, setQuery] = useState('');
  const [weapon, setWeapon] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<WeaponPrefs | null>(null);
  const [sorting, setSorting] = useState(false);

  useEffect(() => {
    readWeaponPrefs().then(setPrefs);
    loadContent()
      .then(setContent)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Não foi possível carregar o catálogo.'));
  }, []);

  // Só skins com raridade: as outras (padrão, passe de batalha) nunca saem na loja.
  const rows = useMemo<(Row & { weaponIndex: number })[]>(() => {
    if (!content) return [];
    // Ordena pela chave já sem acentos (comparar strings em JS puro é rápido).
    return content.skins
      .filter((s) => s.tierUuid)
      .map((s) => {
        const w = content.weapons[s.weapon];
        return {
          uuid: s.uuid,
          name: s.name,
          image: s.image,
          weapon: w?.category === 'Melee' ? MELEE_LABEL : (w?.name ?? ''),
          weaponIndex: s.weapon,
          color: content.tiers[s.tierUuid!]?.color ?? null,
          search: fold(s.name),
        };
      })
      .sort((a, b) => (a.search < b.search ? -1 : a.search > b.search ? 1 : 0));
  }, [content]);

  const filtered = useMemo(() => {
    if (tab === 'list') return rows.filter((r) => ids.has(r.uuid));
    const q = fold(query.trim());
    return rows.filter((r) => (weapon === null || r.weaponIndex === weapon) && (!q || r.search.includes(q)));
  }, [rows, tab, ids, query, weapon]);

  // Onde cada skin da lista está agora (loja do dia ou mercado noturno).
  const where = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of shop?.daily.offers ?? []) if (o.skinUuid) map.set(o.skinUuid, 'Na sua loja hoje');
    for (const o of activeNight(shop)?.offers ?? []) if (o.skinUuid) map.set(o.skinUuid, 'No seu mercado noturno');
    return map;
  }, [shop]);

  // Ordem e armas escondidas escolhidas pela pessoa.
  const weapons = useMemo(() => applyWeaponPrefs(content?.weapons ?? [], prefs), [content, prefs]);
  const savePrefs = (next: WeaponPrefs | null) => {
    setPrefs(next);
    writeWeaponPrefs(next);
  };
  const reorder = (visibleIds: string[]) =>
    savePrefs({ order: [...visibleIds, ...weapons.hidden.map((w) => w.uuid)], hidden: weapons.hidden.map((w) => w.uuid) });
  const hide = (id: string) => {
    const hiddenIds = [...weapons.hidden.map((w) => w.uuid), id];
    savePrefs({ order: [...weapons.visible.map((w) => w.uuid).filter((x) => x !== id), ...hiddenIds], hidden: hiddenIds });
    if (weapon !== null && content?.weapons[weapon]?.uuid === id) setWeapon(null);
  };
  const show = (id: string) => {
    const hiddenIds = weapons.hidden.map((w) => w.uuid).filter((x) => x !== id);
    // Volta para o fim da lista visível.
    savePrefs({ order: [...weapons.visible.map((w) => w.uuid), id, ...hiddenIds], hidden: hiddenIds });
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar para a loja">
          <Text variant="label" color={colors.mute}>
            ‹ Loja
          </Text>
        </Pressable>
      </View>

      <View style={styles.top}>
        <Text variant="title" color={colors.ink}>
          Lista de desejos
        </Text>
        <Text variant="caption" color={colors.ash}>
          Toque no coração para salvar. Avisamos quando uma delas aparecer na sua loja ou no mercado noturno.
        </Text>

        <View style={styles.tabs} accessibilityRole="tablist">
          {(
            [
              ['list', `Minha lista · ${ids.size}`],
              ['catalog', 'Catálogo'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}>
              <Text variant="label" color={tab === key ? colors.ink : colors.mute}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'catalog' ? (
          <>
            <View style={styles.searchRow}>
              <View style={styles.search}>
                <Ionicons name="search" size={16} color={colors.ash} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar skin (ex.: Prime, Reaver)"
                  placeholderTextColor={colors.ash}
                  style={styles.input}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  accessibilityLabel="Buscar skin pelo nome"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Limpar busca">
                    <Ionicons name="close-circle" size={16} color={colors.ash} />
                  </Pressable>
                ) : null}
              </View>
              {/* Mesmo desenho do campo de busca: altura, borda, raio e fundo. */}
              <Pressable
                onPress={() => setSorting(true)}
                disabled={!content}
                style={({ pressed }) => [styles.editButton, pressed && { backgroundColor: colors.surfaceElevated }]}
                accessibilityRole="button"
                accessibilityLabel="Organizar armas do filtro">
                <Ionicons name="options-outline" size={18} color={colors.mute} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Todas" on={weapon === null} onPress={() => setWeapon(null)} />
              {weapons.visible.map((w) => (
                <Chip
                  key={w.uuid}
                  label={w.category === 'Melee' ? MELEE_LABEL : w.name}
                  on={weapon === w.index}
                  onPress={() => setWeapon(weapon === w.index ? null : w.index)}
                  onLongPress={() => setSorting(true)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>

      {error ? (
        <View style={styles.empty}>
          <Text color={colors.body}>{error}</Text>
        </View>
      ) : !content ? (
        <View style={styles.empty}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={ROW_H - space.sm} radius={radius.md} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.uuid}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          windowSize={7}
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text color={colors.mute}>
                {tab === 'list'
                  ? 'Sua lista está vazia. Abra o catálogo e toque no coração das skins que você quer.'
                  : 'Nenhuma skin encontrada com esse nome.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openSkin(item.uuid, { price: 0 })}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceElevated }]}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}. Ver detalhes.`}>
              <View style={[styles.thumb, item.color ? { borderColor: item.color } : null]}>
                <Image source={item.image ?? undefined} style={styles.thumbImage} contentFit="contain" cachePolicy="disk" />
              </View>
              <View style={styles.rowText}>
                <Text variant="label" color={colors.ink} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text variant="caption" color={where.has(item.uuid) ? colors.accent : colors.ash} numberOfLines={1}>
                  {where.get(item.uuid) ?? item.weapon}
                </Text>
              </View>
              <WishHeart skinUuid={item.uuid} name={item.name} size={18} />
            </Pressable>
          )}
        />
      )}
      <WeaponSorter
        visible={sorting}
        shown={weapons.visible}
        hidden={weapons.hidden}
        onClose={() => setSorting(false)}
        onReorder={reorder}
        onHide={hide}
        onShow={show}
        onReset={() => savePrefs(null)}
      />
    </SafeAreaView>
  );
}

function Chip({ label, on, onPress, onLongPress }: { label: string; on: boolean; onPress(): void; onLongPress?(): void }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}>
      <Text variant="caption" color={on ? colors.onPrimary : colors.body}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { height: 48, justifyContent: 'center', paddingHorizontal: space.lg },
  top: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md },
  tabs: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36, borderRadius: radius.sm },
  tabOn: { backgroundColor: colors.surfacePressed },
  searchRow: { flexDirection: 'row', gap: space.sm },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  editButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, ...typeScale.body, color: colors.ink, paddingVertical: space.sm },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  list: { paddingHorizontal: space.lg, paddingBottom: space.section },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, paddingHorizontal: space.xs },
  thumb: {
    width: 84,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '88%', height: '80%' },
  rowText: { flex: 1, gap: 2 },
  empty: { paddingHorizontal: space.lg, gap: space.sm },
  emptyBox: { paddingVertical: space.xl },
});
