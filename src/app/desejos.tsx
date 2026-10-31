import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterSheet } from '@/components/filter-sheet';
import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { WishHeart } from '@/components/wish-heart';
import { loadContent, type Content, type Tier } from '@/lib/content';
import { activeNight } from '@/lib/shop';
import { openSkin } from '@/lib/skin-detail';
import { fold } from '@/lib/text';
import { applyWeaponPrefs, readWeaponPrefs, writeWeaponPrefs, type WeaponPrefs } from '@/lib/weapon-order';
import { useShop } from '@/providers/shop';
import { useWishlist } from '@/providers/wishlist';
import { colors, radius, space, type as typeScale } from '@/theme';

type Row = {
  uuid: string;
  name: string;
  image: string | null;
  weapon: string;
  color: string | null;
  tierUuid: string | null;
  search: string;
};

const ROW_H = 68;

const MELEE_LABEL = 'Corpo a corpo';

export default function Desejos() {
  const { ids, clear } = useWishlist();
  const { shop } = useShop();
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'catalog'>(ids.size ? 'list' : 'catalog');
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<WeaponPrefs | null>(null);
  const [sorting, setSorting] = useState(false);

  useEffect(() => {
    readWeaponPrefs().then(setPrefs);
    loadContent()
      .then(setContent)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Não foi possível carregar o catálogo.'));
  }, []);

  // Só skins com raridade: as outras (padrão, passe de batalha) nunca saem na loja.
  const rows = useMemo<Row[]>(() => {
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
          color: content.tiers[s.tierUuid!]?.color ?? null,
          tierUuid: s.tierUuid,
          search: fold(s.name),
        };
      })
      .sort((a, b) => (a.search < b.search ? -1 : a.search > b.search ? 1 : 0));
  }, [content]);

  // Raridades em ordem (da mais comum à mais rara), só as que existem no catálogo.
  const tiers = useMemo<Tier[]>(() => {
    if (!content) return [];
    return Object.values(content.tiers).sort((a, b) => a.rank - b.rank);
  }, [content]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return rows.filter(
      (r) =>
        (tab === 'catalog' || ids.has(r.uuid)) &&
        (rarity.length === 0 || (r.tierUuid !== null && rarity.includes(r.tierUuid))) &&
        (!q || r.search.includes(q)),
    );
  }, [rows, tab, ids, query, rarity]);

  const filterActive = rarity.length > 0;

  const toggleRarity = (tierUuid: string | null) =>
    setRarity((prev) => (tierUuid === null ? [] : prev.includes(tierUuid) ? prev.filter((t) => t !== tierUuid) : [...prev, tierUuid]));

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
  };
  const show = (id: string) => {
    const hiddenIds = weapons.hidden.map((w) => w.uuid).filter((x) => x !== id);
    // Volta para o fim da lista visível.
    savePrefs({ order: [...weapons.visible.map((w) => w.uuid), id, ...hiddenIds], hidden: hiddenIds });
  };

  const confirmClear = () =>
    Alert.alert('Desmarcar todos?', `Isso remove as ${ids.size} skins salvas da sua lista de desejos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desmarcar todos', style: 'destructive', onPress: clear },
    ]);

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

        {/* Idêntica nas duas abas: só o conteúdo listado abaixo muda. */}
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
            accessibilityLabel="Filtrar por raridade e organizar as armas">
            <Ionicons name="options-outline" size={18} color={colors.mute} />
            {filterActive ? <View style={styles.filterDot} /> : null}
          </Pressable>
        </View>

        {tab === 'list' && ids.size > 0 ? (
          <Pressable onPress={confirmClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Desmarcar todas as skins da lista">
            <Text variant="caption" color={colors.body}>
              Desmarcar todos
            </Text>
          </Pressable>
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
                <Image source={item.image ?? undefined} style={styles.thumbImage} contentFit="contain" cachePolicy="memory-disk" />
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
      <FilterSheet
        visible={sorting}
        shown={weapons.visible}
        hidden={weapons.hidden}
        tiers={tiers}
        rarity={rarity}
        onRarity={toggleRarity}
        onClose={() => setSorting(false)}
        onReorder={reorder}
        onHide={hide}
        onShow={show}
        onReset={() => savePrefs(null)}
      />
    </SafeAreaView>
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
  filterDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  input: { flex: 1, ...typeScale.body, color: colors.ink, paddingVertical: space.sm },
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
