/**
 * Modelo da loja usado pelas telas, montado a partir da resposta da Riot e do
 * catálogo da valorant-api.com. Os "endsAt" são absolutos (epoch ms) para que
 * o cache continue correto depois de reaberto.
 */
import { skinForLevel, tierFor, type Content, type Tier } from './content';
import { fetchStorefront, fetchWallet } from './riot/api';
import { CURRENCY, ITEM_TYPE_SKIN_LEVEL } from './riot/constants';
import type { Account } from './riot/session';
import type { StorefrontResponse, WalletResponse } from './riot/types';
import { keys, readJson, writeJson } from './storage';

export type SkinOffer = {
  id: string;
  /** UUID da skin (para a tela de detalhes). */
  skinUuid: string | null;
  name: string;
  image: string | null;
  price: number;
  tier: Tier | null;
};

/** Item de um pacote, como vem da loja (nome e imagem resolvidos na tela do pacote). */
export type BundleItem = {
  typeId: string;
  itemId: string;
  price: number;
  basePrice: number;
};

export type FeaturedBundle = {
  id: string;
  name: string;
  image: string | null;
  price: number;
  basePrice: number | null;
  endsAt: number;
  items: BundleItem[];
};

export type NightOffer = {
  /** BonusOfferID: único por oferta e por mercado, usado para salvar a revelação. */
  id: string;
  skinUuid: string | null;
  name: string;
  image: string | null;
  tier: Tier | null;
  basePrice: number;
  finalPrice: number;
  discountPercent: number;
};

export type Shop = {
  puuid: string;
  fetchedAt: number;
  wallet: { vp: number; rad: number; kc: number } | null;
  bundles: FeaturedBundle[];
  daily: { offers: SkinOffer[]; endsAt: number };
  /**
   * `startedAt`: a Riot só informa o fim do mercado; o início é quando o app
   * viu este mercado pela primeira vez (ver night-market.ts).
   */
  night: { offers: NightOffer[]; endsAt: number; startedAt?: number } | null;
};

const vp = (cost: Record<string, number> | null | undefined) => cost?.[CURRENCY.vp] ?? 0;

export function buildShop(
  puuid: string,
  content: Content,
  store: StorefrontResponse,
  wallet: WalletResponse | null,
  now = Date.now(),
): Shop {
  const at = (seconds: number) => now + seconds * 1000;

  const bundles: FeaturedBundle[] = store.FeaturedBundle.Bundles.map((b) => {
    const info = content.bundles[b.DataAssetID];
    const sum = b.Items.reduce((acc, i) => acc + (i.DiscountedPrice ?? 0), 0);
    const base = b.Items.reduce((acc, i) => acc + (i.BasePrice ?? 0), 0);
    const price = vp(b.TotalDiscountedCost) || sum;
    const basePrice = vp(b.TotalBaseCost) || base;
    return {
      id: b.ID,
      name: info?.name ?? 'Pacote',
      image: info?.image ?? null,
      price,
      basePrice: basePrice > price ? basePrice : null,
      endsAt: at(b.DurationRemainingInSeconds ?? store.FeaturedBundle.BundleRemainingDurationInSeconds),
      items: b.Items.map((i) => ({
        typeId: i.Item.ItemTypeID,
        itemId: i.Item.ItemID,
        price: i.DiscountedPrice ?? i.BasePrice ?? 0,
        basePrice: i.BasePrice ?? 0,
      })),
    };
  });

  const panel = store.SkinsPanelLayout;
  const offers: SkinOffer[] = panel.SingleItemStoreOffers.map((o) => {
    const itemId =
      o.Rewards.find((r) => r.ItemTypeID === ITEM_TYPE_SKIN_LEVEL)?.ItemID ?? o.OfferID;
    const skin = skinForLevel(content, itemId);
    return {
      id: o.OfferID,
      skinUuid: skin?.uuid ?? null,
      name: skin?.name ?? 'Skin',
      image: skin?.image ?? null,
      price: vp(o.Cost),
      tier: tierFor(content, skin?.tierUuid ?? null),
    };
  });

  const bonus = store.BonusStore;
  const night = bonus?.BonusStoreOffers?.length
    ? {
        endsAt: at(bonus.BonusStoreRemainingDurationInSeconds),
        offers: bonus.BonusStoreOffers.map((b): NightOffer => {
          const itemId = b.Offer.Rewards[0]?.ItemID ?? b.Offer.OfferID;
          const skin = skinForLevel(content, itemId);
          return {
            id: b.BonusOfferID,
            skinUuid: skin?.uuid ?? null,
            name: skin?.name ?? 'Skin',
            image: skin?.image ?? null,
            tier: tierFor(content, skin?.tierUuid ?? null),
            basePrice: vp(b.Offer.Cost),
            finalPrice: vp(b.DiscountCosts),
            discountPercent: b.DiscountPercent,
          };
        }),
      }
    : null;

  return {
    puuid,
    fetchedAt: now,
    wallet: wallet
      ? {
          vp: wallet.Balances[CURRENCY.vp] ?? 0,
          rad: wallet.Balances[CURRENCY.rad] ?? 0,
          kc: wallet.Balances[CURRENCY.kc] ?? 0,
        }
      : null,
    bundles,
    daily: { offers, endsAt: at(panel.SingleItemOffersRemainingDurationInSeconds) },
    night,
  };
}

/** Busca loja + saldo na Riot. O saldo é opcional: se falhar, a loja sai mesmo assim. */
export async function fetchShop(acc: Account, content: Content): Promise<Shop> {
  const [store, wallet] = await Promise.all([
    fetchStorefront(acc, content.riotClientVersion),
    fetchWallet(acc, content.riotClientVersion).catch(() => null),
  ]);
  return buildShop(acc.puuid, content, store, wallet);
}

export async function readCachedShop(puuid: string): Promise<Shop | null> {
  const shop = await readJson<Shop>(keys.shop);
  return shop && shop.puuid === puuid ? shop : null;
}

export function cacheShop(shop: Shop): Promise<void> {
  return writeJson(keys.shop, shop);
}

/** O mercado noturno do cache ainda está valendo? */
export function activeNight(shop: Shop | null, now = Date.now()) {
  return shop?.night && shop.night.endsAt > now ? shop.night : null;
}
