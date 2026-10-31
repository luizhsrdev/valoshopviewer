/**
 * Detalhes de uma skin (variantes, níveis e vídeos) da valorant-api.com,
 * baixados sob demanda ao abrir a tela de detalhes e guardados em memória.
 */
import { router } from 'expo-router';

import { loadContent, tierFor, type Tier } from './content';

type ApiSkin = {
  uuid: string;
  displayName: string;
  contentTierUuid: string | null;
  displayIcon: string | null;
  wallpaper: string | null;
  chromas: {
    uuid: string;
    displayName: string;
    displayIcon: string | null;
    fullRender: string | null;
    swatch: string | null;
    streamedVideo: string | null;
  }[];
  levels: {
    uuid: string;
    displayName: string;
    levelItem: string | null;
    displayIcon: string | null;
    streamedVideo: string | null;
  }[];
};

export type SkinVariant = {
  uuid: string;
  label: string;
  image: string | null;
  swatch: string | null;
  video: string | null;
};

export type SkinLevel = {
  uuid: string;
  number: number;
  label: string;
  video: string | null;
};

export type SkinDetail = {
  uuid: string;
  name: string;
  tier: Tier | null;
  variants: SkinVariant[];
  levels: SkinLevel[];
};

/** O que cada nível desbloqueia, em pt-BR. */
const LEVEL_ITEMS: Record<string, string> = {
  VFX: 'Efeitos visuais',
  Animation: 'Animação',
  SoundEffects: 'Efeitos sonoros',
  Finisher: 'Finalização',
  KillBanner: 'Banner de abate',
  KillCounter: 'Contador de abates',
  KillEffect: 'Efeito de abate',
  TopFrag: 'Efeito de melhor jogador',
  Transformation: 'Transformação',
  Randomizer: 'Aleatorizador',
  InspectAndKill: 'Inspeção e abate',
  SongShuffle: 'Troca de música',
  Voiceover: 'Narração',
  HeartbeatAndMapSensor: 'Batimentos e sensor de mapa',
  FishAnimation: 'Animação de peixe',
  AttackerDefenderSwap: 'Troca ataque/defesa',
};

function levelLabel(levelItem: string | null, index: number): string {
  if (index === 0 || !levelItem) return 'Padrão';
  const key = levelItem.split('::')[1] ?? levelItem;
  return LEVEL_ITEMS[key] ?? key;
}

/** "Odin Apocalíptica Nível 4 (Variante 1 Vermelha)" → "Vermelha". */
function variantLabel(name: string, skinName: string, index: number): string {
  if (index === 0) return 'Padrão';
  const inParens = name.match(/\(([^)]+)\)/)?.[1];
  const raw = inParens ?? name.replace(skinName, '').trim();
  return raw.replace(/^Variante\s+\d+\s*/i, '').trim() || `Variante ${index}`;
}

const memory = new Map<string, SkinDetail>();

/** UUID no formato da valorant-api (o ID pode chegar por deep link). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadSkinDetail(uuid: string): Promise<SkinDetail> {
  if (!UUID.test(uuid)) throw new Error('Skin não encontrada.');
  const cached = memory.get(uuid);
  if (cached) return cached;
  const [res, content] = await Promise.all([
    fetch(`https://valorant-api.com/v1/weapons/skins/${uuid}?language=pt-BR`),
    loadContent(),
  ]);
  if (!res.ok) throw new Error(`Não foi possível carregar os detalhes (erro ${res.status}).`);
  const s = ((await res.json()) as { data: ApiSkin }).data;

  const detail: SkinDetail = {
    uuid: s.uuid,
    name: s.displayName,
    tier: tierFor(content, s.contentTierUuid),
    variants: s.chromas.map((c, i) => ({
      uuid: c.uuid,
      label: variantLabel(c.displayName, s.displayName, i),
      image: c.fullRender ?? c.displayIcon ?? (i === 0 ? s.displayIcon : null),
      swatch: c.swatch,
      video: c.streamedVideo,
    })),
    levels: s.levels.map((l, i) => ({
      uuid: l.uuid,
      number: i + 1,
      label: levelLabel(l.levelItem, i),
      video: l.streamedVideo,
    })),
  };
  memory.set(uuid, detail);
  return detail;
}

/** Preço que a tela de origem passa para os detalhes. */
export type SkinPrice = { price: number; basePrice?: number; discountPercent?: number };

export function openSkin(skinUuid: string | null, price: SkinPrice) {
  if (!skinUuid) return;
  router.push({
    pathname: '/skin/[id]',
    params: {
      id: skinUuid,
      price: String(price.price),
      ...(price.basePrice ? { base: String(price.basePrice) } : {}),
      ...(price.discountPercent ? { discount: String(price.discountPercent) } : {}),
    },
  });
}
