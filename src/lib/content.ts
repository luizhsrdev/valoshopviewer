/**
 * Catálogo estático da valorant-api.com (nomes em pt-BR, imagens, raridades,
 * pacotes e versão do cliente). Guardado de forma compacta e só baixado de
 * novo quando a versão do jogo muda.
 */
import { rarityHex } from '@/theme';

import { keys, legacyKeys, readJson, remove, writeJson } from './storage';

const API = 'https://valorant-api.com/v1';
const LANG = 'language=pt-BR';

export type Tier = { uuid: string; name: string; color: string; rank: number };

export type SkinInfo = {
  uuid: string;
  name: string;
  image: string | null;
  tierUuid: string | null;
  /** Índice em `weapons`. */
  weapon: number;
};

export type WeaponInfo = { uuid: string; name: string; category: string };

export type Content = {
  version: string;
  /** Usado no cabeçalho X-Riot-ClientVersion. */
  riotClientVersion: string;
  tiers: Record<string, Tier>;
  /** Na ordem do filtro: pistolas, submetralhadoras, escopetas, fuzis, snipers, metralhadoras, corpo a corpo. */
  weapons: WeaponInfo[];
  skins: SkinInfo[];
  /** UUID do nível de skin (é o ItemID das ofertas) → índice em `skins`. */
  levelToSkin: Record<string, number>;
  bundles: Record<string, { name: string; image: string | null }>;
};

type ApiList<T> = { status: number; data: T[] };
type ApiOne<T> = { status: number; data: T };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`valorant-api.com respondeu ${res.status}.`);
  return (await res.json()) as T;
}

/** Nomes das raridades em pt-BR seguem o jogo; mantemos os originais. */
const TIER_NAMES: Record<string, string> = {
  Select: 'Select',
  Deluxe: 'Deluxe',
  Premium: 'Premium',
  Exclusive: 'Exclusive',
  Ultra: 'Ultra',
};

async function download(version: string, riotClientVersion: string): Promise<Content> {
  const [tiersRes, weaponsRes, bundlesRes] = await Promise.all([
    get<ApiList<{ uuid: string; devName: string; rank: number; highlightColor: string }>>(
      `/contenttiers?${LANG}`,
    ),
    // /weapons traz as mesmas skins de /weapons/skins, já agrupadas por arma (para o filtro).
    get<
      ApiList<{
        uuid: string;
        displayName: string;
        category: string;
        skins: {
          uuid: string;
          displayName: string;
          contentTierUuid: string | null;
          displayIcon: string | null;
          levels: { uuid: string; displayIcon: string | null }[];
          chromas: { fullRender: string | null; displayIcon: string | null }[];
        }[];
      }>
    >(`/weapons?${LANG}`),
    get<ApiList<{ uuid: string; displayName: string; displayIcon: string | null }>>(
      `/bundles?${LANG}`,
    ),
  ]);

  const tiers: Content['tiers'] = {};
  for (const t of tiersRes.data) {
    tiers[t.uuid] = {
      uuid: t.uuid,
      name: TIER_NAMES[t.devName] ?? t.devName,
      color: rarityHex(t.highlightColor),
      rank: t.rank,
    };
  }

  const order = ['Sidearm', 'SMG', 'Shotgun', 'Rifle', 'Sniper', 'Heavy', 'Melee'];
  const rank = (category: string) => {
    const i = order.indexOf(category.split('::')[1] ?? category);
    return i === -1 ? order.length : i;
  };
  const sortedWeapons = [...weaponsRes.data].sort(
    (a, b) => rank(a.category) - rank(b.category) || a.displayName.localeCompare(b.displayName, 'pt-BR'),
  );

  // Compacto de propósito: o AsyncStorage do Android tem limite por item.
  const weapons: WeaponInfo[] = [];
  const skins: SkinInfo[] = [];
  const levelToSkin: Content['levelToSkin'] = {};
  for (const w of sortedWeapons) {
    const weapon = weapons.length;
    weapons.push({ uuid: w.uuid, name: w.displayName, category: w.category.split('::')[1] ?? w.category });
    for (const s of w.skins) {
      const index = skins.length;
      skins.push({
        uuid: s.uuid,
        name: s.displayName,
        // O displayIcon da skin às vezes é um "X" (arte faltando na valorant-api);
        // o render da primeira variante é sempre a arma de verdade.
        image: s.chromas[0]?.fullRender ?? s.levels[0]?.displayIcon ?? s.displayIcon ?? null,
        tierUuid: s.contentTierUuid,
        weapon,
      });
      for (const level of s.levels) levelToSkin[level.uuid] = index;
    }
  }

  const bundles: Content['bundles'] = {};
  for (const b of bundlesRes.data) bundles[b.uuid] = { name: b.displayName, image: b.displayIcon };

  return { version, riotClientVersion, tiers, weapons, skins, levelToSkin, bundles };
}

let memory: Content | null = null;

/**
 * Catálogo pronto para uso. Usa o cache e só baixa de novo se a versão mudou.
 * Sem internet, devolve o cache (se houver).
 */
export async function loadContent(): Promise<Content> {
  const cached = memory ?? (await readJson<Content>(keys.content));
  let version: { version: string; riotClientVersion: string } | null = null;
  try {
    version = (await get<ApiOne<{ version: string; riotClientVersion: string }>>('/version')).data;
  } catch (e) {
    if (cached) return (memory = cached);
    throw e;
  }
  if (cached && cached.version === version.version) return (memory = cached);
  const fresh = await download(version.version, version.riotClientVersion);
  await writeJson(keys.content, fresh);
  if (!cached) await remove(...legacyKeys);
  return (memory = fresh);
}

export function cachedContent(): Content | null {
  return memory;
}

export function skinForLevel(content: Content, levelUuid: string): SkinInfo | null {
  const i = content.levelToSkin[levelUuid];
  return i === undefined ? null : (content.skins[i] ?? null);
}

export function tierFor(content: Content, tierUuid: string | null): Tier | null {
  return tierUuid ? (content.tiers[tierUuid] ?? null) : null;
}
