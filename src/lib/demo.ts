/**
 * Modo de demonstração (somente em desenvolvimento): uma loja falsa, com
 * mercado noturno, montada com skins reais do catálogo da valorant-api.com.
 * Em builds de produção (`__DEV__ === false`) tudo aqui fica desligado.
 */
import { loadContent, type Content } from './content';
import { ITEM_TYPE } from './riot/constants';
import type { FeaturedBundle, NightOffer, Shop, SkinOffer } from './shop';
import { keys, readJson, writeJson } from './storage';

export const DEMO_PUUID = 'demo';

export type DemoState = { enabled: boolean; seed: number; createdAt: number; night: boolean };

const DAY = 86_400_000;

export async function readDemo(): Promise<DemoState | null> {
  if (!__DEV__) return null;
  return readJson<DemoState>(keys.demo);
}

export async function isDemoEnabled(): Promise<boolean> {
  return !!(await readDemo())?.enabled;
}

export async function writeDemo(state: DemoState | null): Promise<void> {
  if (!__DEV__) return;
  await writeJson(keys.demo, state);
}

export function newDemoState(night = true): DemoState {
  return { enabled: true, seed: Math.floor(Math.random() * 1e9), createdAt: Date.now(), night };
}

/** Gerador pseudoaleatório determinístico: mesma semente → mesma loja. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Preços típicos por raridade (em VP). */
const PRICE_BY_RANK = [875, 1275, 1775, 2175, 2475];

function nextUtcMidnight(now: number) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export function buildDemoShop(content: Content, state: DemoState, now = Date.now()): Shop {
  const rand = rng(state.seed);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]!;

  const tiers = Object.values(content.tiers).sort((a, b) => a.rank - b.rank);
  const withImage = content.skins.filter((s) => s.image && s.tierUuid);
  const byTier = (uuid: string) => withImage.filter((s) => s.tierUuid === uuid);
  const skinOfRank = (rank: number) => {
    const tier = tiers[Math.min(rank, tiers.length - 1)]!;
    const skin = pick(byTier(tier.uuid));
    return { skin, tier };
  };

  // Primeiro nível de cada skin (é o ItemID que a loja usa).
  const firstLevel = new Map<number, string>();
  for (const [level, index] of Object.entries(content.levelToSkin)) {
    if (!firstLevel.has(index)) firstLevel.set(index, level);
  }
  const rankOf = (tierUuid: string | null) => (tierUuid ? (content.tiers[tierUuid]?.rank ?? 2) : 2);

  /** Skins do pacote: as que levam o nome dele (ex.: "Phantom Vingança de Gaia"); senão, 4 sorteadas. */
  const bundleSkins = (name: string) => {
    const needle = name.toLowerCase();
    const matching = content.skins
      .map((skin, index) => ({ skin, index }))
      .filter(({ skin }) => skin.image && skin.tierUuid && needle.length >= 3 && skin.name.toLowerCase().includes(needle));
    if (matching.length >= 2) return matching.slice(0, 5);
    return [0, 1, 2, 3].map(() => {
      const skin = pick(withImage);
      return { skin, index: content.skins.indexOf(skin) };
    });
  };

  const bundleEntries = Object.entries(content.bundles).filter(([, b]) => b.image);
  const bundles: FeaturedBundle[] = [0, 1].map((i) => {
    const [id, b] = pick(bundleEntries);
    const items = bundleSkins(b.name).map(({ skin, index }) => {
      const basePrice = PRICE_BY_RANK[rankOf(skin.tierUuid)]!;
      return {
        typeId: ITEM_TYPE.skinLevel,
        itemId: firstLevel.get(index) ?? skin.uuid,
        price: Math.round((basePrice * 0.8) / 5) * 5,
        basePrice,
      };
    });
    const price = items.reduce((sum, it) => sum + it.price, 0);
    const basePrice = items.reduce((sum, it) => sum + it.basePrice, 0);
    return {
      id: `demo-bundle-${state.seed}-${i}-${id}`,
      name: b.name,
      image: b.image,
      price,
      basePrice: basePrice > price ? basePrice : null,
      endsAt: state.createdAt + (i === 0 ? 5 : 2) * DAY + 6 * 3_600_000,
      items,
    };
  });

  const daily: SkinOffer[] = [3, 2, 1, 0].map((rank, i) => {
    const { skin, tier } = skinOfRank(rank);
    return {
      id: `demo-daily-${state.seed}-${i}`,
      skinUuid: skin.uuid,
      name: skin.name,
      image: skin.image,
      price: PRICE_BY_RANK[rank]!,
      tier,
    };
  });

  // Como no jogo, o mercado noturno só tem Select, Deluxe, Premium e Exclusive
  // (Ultra nunca sai). Uma de cada + duas extras, embaralhadas.
  const ranks = [0, 1, 2, 3, Math.floor(rand() * 4), Math.floor(rand() * 4)].sort(() => rand() - 0.5);
  const nightOffers: NightOffer[] = ranks.map((rank, i) => {
    const { skin, tier } = skinOfRank(rank);
    const basePrice = PRICE_BY_RANK[rank]!;
    const discountPercent = 10 + Math.floor(rand() * 40);
    return {
      id: `demo-night-${state.seed}-${i}`,
      skinUuid: skin.uuid,
      name: skin.name,
      image: skin.image,
      tier,
      basePrice,
      discountPercent,
      finalPrice: Math.round((basePrice * (100 - discountPercent)) / 100 / 5) * 5,
    };
  });

  return {
    puuid: DEMO_PUUID,
    fetchedAt: now,
    wallet: { vp: 2340, rad: 85, kc: 4210 },
    bundles,
    daily: { offers: daily, endsAt: nextUtcMidnight(now) },
    night: state.night ? { offers: nightOffers, endsAt: state.createdAt + 3 * DAY } : null,
  };
}

export async function fetchDemoShop(state: DemoState): Promise<Shop> {
  const content = await loadContent();
  // Simula a latência da rede para ver o skeleton.
  await new Promise((r) => setTimeout(r, 700));
  return buildDemoShop(content, state);
}
