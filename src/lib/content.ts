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

export type SkinInfo = { uuid: string; name: string; image: string | null; tierUuid: string | null };

export type Content = {
  version: string;
  /** Usado no cabeçalho X-Riot-ClientVersion. */
  riotClientVersion: string;
  tiers: Record<string, Tier>;
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
  const [tiersRes, skinsRes, bundlesRes] = await Promise.all([
    get<ApiList<{ uuid: string; devName: string; rank: number; highlightColor: string }>>(
      `/contenttiers?${LANG}`,
    ),
    get<
      ApiList<{
        uuid: string;
        displayName: string;
        contentTierUuid: string | null;
        displayIcon: string | null;
        levels: { uuid: string; displayIcon: string | null }[];
        chromas: { fullRender: string | null; displayIcon: string | null }[];
      }>
    >(`/weapons/skins?${LANG}`),
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

  // Compacto de propósito: o AsyncStorage do Android tem limite por item.
  const skins: SkinInfo[] = [];
  const levelToSkin: Content['levelToSkin'] = {};
  for (const s of skinsRes.data) {
    const index = skins.length;
    skins.push({
      uuid: s.uuid,
      name: s.displayName,
      image: s.displayIcon ?? s.chromas[0]?.fullRender ?? s.levels[0]?.displayIcon ?? null,
      tierUuid: s.contentTierUuid,
    });
    for (const level of s.levels) levelToSkin[level.uuid] = index;
  }

  const bundles: Content['bundles'] = {};
  for (const b of bundlesRes.data) bundles[b.uuid] = { name: b.displayName, image: b.displayIcon };

  return { version, riotClientVersion, tiers, skins, levelToSkin, bundles };
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
