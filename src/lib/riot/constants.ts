/** URLs e IDs da API interna da Riot (documentação da comunidade). */

export const AUTH_ORIGIN = 'https://auth.riotgames.com';

/** Página oficial de login e endpoint de reautenticação por cookie (mesma URL). */
export const AUTHORIZE_URL =
  'https://auth.riotgames.com/authorize' +
  '?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in' +
  '&client_id=play-valorant-web-prod' +
  '&response_type=token%20id_token' +
  '&nonce=1' +
  '&scope=account%20openid';

/** Destino do redirecionamento com os tokens no fragmento (#access_token=...). */
export const REDIRECT_PREFIX = 'https://playvalorant.com/opt_in';

export const ENTITLEMENTS_URL = 'https://entitlements.auth.riotgames.com/api/token/v1';
export const USERINFO_URL = 'https://auth.riotgames.com/userinfo';
export const RIOT_GEO_URL = 'https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant';

export const pdUrl = (shard: string) => `https://pd.${shard}.a.pvp.net`;

/** JSON de plataforma PC em base64, exigido pelos endpoints pd.*. */
export const CLIENT_PLATFORM = btoa(
  JSON.stringify({
    platformType: 'PC',
    platformOS: 'Windows',
    platformOSVersion: '10.0.19042.1.256.64bit',
    platformChipset: 'Unknown',
  }),
);

export const CURRENCY = {
  vp: '85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741',
  rad: 'e59aa87c-4cbf-517a-5983-6e81511be9b7',
  kc: '85ca954a-41f2-ce94-9b45-8ca3dd39a00d',
} as const;

/** Tipos de item da loja (ItemTypeID). As ofertas de skin apontam para o nível 1. */
export const ITEM_TYPE = {
  skinLevel: 'e7c63390-eda7-46e0-bb7a-a6abdacd2433',
  buddyLevel: 'dd3bf334-87f3-40bd-b043-682a57a8dc3a',
  playerCard: '3f296c07-64c3-494c-923b-fe692a4fa1bd',
  spray: 'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475',
  playerTitle: 'de7caa6b-adf7-4588-bbd1-143831e786c6',
} as const;
export const ITEM_TYPE_SKIN_LEVEL = ITEM_TYPE.skinLevel;

/** riot-geo devolve a afinidade; BR e LATAM jogam no shard "na". */
export function shardFromAffinity(live: string): string {
  switch (live) {
    case 'br':
    case 'latam':
    case 'na':
      return 'na';
    case 'pbe':
      return 'pbe';
    default:
      return live; // eu, ap, kr
  }
}
