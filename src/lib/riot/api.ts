import { CLIENT_PLATFORM, pdUrl } from './constants';
import { getTokens, type Account } from './session';
import type { StorefrontResponse, WalletResponse } from './types';

export class RiotHttpError extends Error {
  constructor(
    readonly status: number,
    what: string,
  ) {
    super(`A Riot recusou o pedido de ${what} (erro ${status}).`);
    this.name = 'RiotHttpError';
  }
}

async function pd<T>(
  acc: Account,
  clientVersion: string,
  path: string,
  what: string,
  init: RequestInit = {},
): Promise<T> {
  const call = async (force: boolean) => {
    const t = await getTokens(force);
    return fetch(`${pdUrl(acc.shard)}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${t.accessToken}`,
        'X-Riot-Entitlements-JWT': t.entitlementsToken,
        'X-Riot-ClientVersion': clientVersion,
        'X-Riot-ClientPlatform': CLIENT_PLATFORM,
        'Content-Type': 'application/json',
      },
    });
  };
  let res = await call(false);
  // Token recusado: renova uma vez e tenta de novo.
  if (res.status === 400 || res.status === 401) res = await call(true);
  if (!res.ok) throw new RiotHttpError(res.status, what);
  return (await res.json()) as T;
}

export function fetchStorefront(acc: Account, clientVersion: string) {
  return pd<StorefrontResponse>(acc, clientVersion, `/store/v3/storefront/${acc.puuid}`, 'loja', {
    method: 'POST',
    body: '{}',
  });
}

export function fetchWallet(acc: Account, clientVersion: string) {
  return pd<WalletResponse>(acc, clientVersion, `/store/v1/wallet/${acc.puuid}`, 'saldo');
}
