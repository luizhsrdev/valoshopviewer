/** Tipos das respostas da API interna (apenas os campos que usamos). */

export type CostMap = Record<string, number>;

export type StorefrontBundle = {
  ID: string;
  DataAssetID: string;
  CurrencyID: string;
  Items: {
    Item: { ItemTypeID: string; ItemID: string; Amount?: number; Quantity?: number };
    BasePrice: number;
    DiscountedPrice: number;
    DiscountPercent: number;
  }[];
  TotalBaseCost?: CostMap | null;
  TotalDiscountedCost?: CostMap | null;
  DurationRemainingInSeconds: number;
};

export type StorefrontResponse = {
  FeaturedBundle: {
    Bundles: StorefrontBundle[];
    BundleRemainingDurationInSeconds: number;
  };
  SkinsPanelLayout: {
    SingleItemOffers: string[];
    SingleItemStoreOffers: {
      OfferID: string;
      Cost: CostMap;
      Rewards: { ItemTypeID: string; ItemID: string; Quantity: number }[];
    }[];
    SingleItemOffersRemainingDurationInSeconds: number;
  };
  BonusStore?: {
    BonusStoreOffers: {
      BonusOfferID: string;
      Offer: {
        OfferID: string;
        Cost: CostMap;
        Rewards: { ItemTypeID: string; ItemID: string; Quantity: number }[];
      };
      DiscountPercent: number;
      DiscountCosts: CostMap;
      IsSeen: boolean;
    }[];
    BonusStoreRemainingDurationInSeconds: number;
  };
};

export type WalletResponse = { Balances: Record<string, number> };

export type UserInfoResponse = {
  sub: string;
  acct?: { game_name?: string; tag_line?: string };
};

export type RiotGeoResponse = {
  token: string;
  affinities: { pbe: string; live: string };
};
