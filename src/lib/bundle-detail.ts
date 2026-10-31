/**
 * Resolve os itens de um pacote (skins, chaveiros, cards, sprays e títulos)
 * em nome, imagem e raridade, usando a valorant-api.com. Skins vêm do
 * catálogo já salvo; os outros tipos são buscados sob demanda e guardados
 * em memória.
 */
import { loadContent, skinForLevel, tierFor, type Tier } from './content';
import { safeFetch } from './net';
import { ITEM_TYPE } from './riot/constants';
import type { BundleItem } from './shop';

const API = 'https://valorant-api.com/v1';
const LANG = 'language=pt-BR';

export type BundleItemKind = 'skin' | 'buddy' | 'card' | 'spray' | 'title' | 'other';

export type ResolvedBundleItem = {
  key: string;
  kind: BundleItemKind;
  name: string;
  image: string | null;
  price: number;
  basePrice: number;
  /** Só para skins: abre a tela de detalhes. */
  skinUuid: string | null;
  tier: Tier | null;
};

export const KIND_LABEL: Record<BundleItemKind, string> = {
  skin: 'Skin',
  buddy: 'Chaveiro',
  card: 'Card de jogador',
  spray: 'Spray',
  title: 'Título',
  other: 'Item',
};

const KIND_BY_TYPE: Record<string, BundleItemKind> = {
  [ITEM_TYPE.skinLevel]: 'skin',
  [ITEM_TYPE.buddyLevel]: 'buddy',
  [ITEM_TYPE.playerCard]: 'card',
  [ITEM_TYPE.spray]: 'spray',
  [ITEM_TYPE.playerTitle]: 'title',
};

const memory = new Map<string, { name: string; image: string | null }>();
let buddyByLevel: Map<string, { name: string; image: string | null }> | null = null;

async function get<T>(path: string): Promise<T> {
  const res = await safeFetch(`${API}${path}`);
  if (!res.ok) throw new Error(`valorant-api.com respondeu ${res.status}.`);
  return ((await res.json()) as { data: T }).data;
}

/** O nível do chaveiro tem nome interno; o nome bonito fica no chaveiro "pai". */
async function buddy(levelId: string) {
  if (!buddyByLevel) {
    const list = await get<{ displayName: string; displayIcon: string | null; levels: { uuid: string; displayIcon: string | null }[] }[]>(
      `/buddies?${LANG}`,
    );
    buddyByLevel = new Map();
    for (const b of list) {
      for (const l of b.levels) buddyByLevel.set(l.uuid, { name: b.displayName, image: l.displayIcon ?? b.displayIcon });
    }
  }
  return buddyByLevel.get(levelId) ?? null;
}

async function cosmetic(kind: BundleItemKind, id: string): Promise<{ name: string; image: string | null } | null> {
  const key = `${kind}:${id}`;
  const cached = memory.get(key);
  if (cached) return cached;
  let found: { name: string; image: string | null } | null = null;
  try {
    if (kind === 'buddy') found = await buddy(id);
    if (kind === 'card') {
      const c = await get<{ displayName: string; wideArt: string | null; displayIcon: string | null }>(`/playercards/${id}?${LANG}`);
      found = { name: c.displayName, image: c.wideArt ?? c.displayIcon };
    }
    if (kind === 'spray') {
      const s = await get<{ displayName: string; fullTransparentIcon: string | null; displayIcon: string | null }>(`/sprays/${id}?${LANG}`);
      found = { name: s.displayName, image: s.fullTransparentIcon ?? s.displayIcon };
    }
    if (kind === 'title') {
      const t = await get<{ displayName: string; titleText: string | null }>(`/playertitles/${id}?${LANG}`);
      found = { name: t.titleText ? `“${t.titleText}”` : t.displayName, image: null };
    }
  } catch {
    found = null;
  }
  if (found) memory.set(key, found);
  return found;
}

/** Skins primeiro (as mais caras antes), depois os outros itens. */
export async function resolveBundleItems(items: BundleItem[]): Promise<ResolvedBundleItem[]> {
  const content = await loadContent();
  const resolved = await Promise.all(
    items.map(async (item, i): Promise<ResolvedBundleItem> => {
      const kind = KIND_BY_TYPE[item.typeId] ?? 'other';
      const base = { key: `${i}:${item.itemId}`, kind, price: item.price, basePrice: item.basePrice };
      if (kind === 'skin') {
        const skin = skinForLevel(content, item.itemId);
        return {
          ...base,
          name: skin?.name ?? 'Skin',
          image: skin?.image ?? null,
          skinUuid: skin?.uuid ?? null,
          tier: tierFor(content, skin?.tierUuid ?? null),
        };
      }
      const info = await cosmetic(kind, item.itemId);
      return { ...base, name: info?.name ?? KIND_LABEL[kind], image: info?.image ?? null, skinUuid: null, tier: null };
    }),
  );
  const order: BundleItemKind[] = ['skin', 'buddy', 'card', 'spray', 'title', 'other'];
  return resolved.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.basePrice - a.basePrice);
}
