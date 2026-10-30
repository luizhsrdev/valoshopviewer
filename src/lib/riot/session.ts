/**
 * Sessão da Riot: tokens, cookies e reautenticação silenciosa.
 *
 * Regras de segurança:
 * - O app nunca vê a senha: o login acontece na página oficial (WebView).
 * - Cookies de sessão (ssid etc.) ficam no expo-secure-store.
 * - Tokens só em memória; a cada abertura do app renovamos pelo cookie.
 * - Nada aqui pode ir para console.log (tokens/cookies/URLs com fragmento).
 */
import * as SecureStore from 'expo-secure-store';

import RiotCookies from '../../../modules/riot-cookies';
import {
  AUTH_ORIGIN,
  AUTHORIZE_URL,
  ENTITLEMENTS_URL,
  REDIRECT_PREFIX,
  RIOT_GEO_URL,
  shardFromAffinity,
  USERINFO_URL,
} from './constants';
import type { RiotGeoResponse, UserInfoResponse } from './types';

export type Account = {
  puuid: string;
  shard: string;
  gameName: string | null;
  tagLine: string | null;
};

export type Tokens = {
  accessToken: string;
  entitlementsToken: string;
  /** Epoch em ms; renovamos um pouco antes. */
  expiresAt: number;
};

/** A sessão expirou de vez: é preciso fazer login de novo. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Sua sessão da Riot expirou. Entre de novo.');
    this.name = 'SessionExpiredError';
  }
}

const SECURE_ACCOUNT = 'riot.account';
const SECURE_COOKIE_NAMES = 'riot.cookie.names';
const secureCookieKey = (name: string) => `riot.cookie.${name.replace(/[^A-Za-z0-9._-]/g, '_')}`;

let tokens: Tokens | null = null;
let account: Account | null = null;
let reauthInFlight: Promise<Tokens> | null = null;

// ---------------------------------------------------------------------------
// Tokens a partir da URL de redirecionamento
// ---------------------------------------------------------------------------

export function isRedirectWithTokens(url: string): boolean {
  return url.startsWith(REDIRECT_PREFIX) && url.includes('access_token=');
}

export function parseRedirect(url: string) {
  const hash = url.split('#')[1] ?? '';
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const idToken = params.get('id_token');
  const expiresIn = Number(params.get('expires_in') ?? '3600');
  if (!accessToken || !idToken) return null;
  return { accessToken, idToken, expiresAt: Date.now() + (expiresIn - 300) * 1000 };
}

// ---------------------------------------------------------------------------
// Cookies (CookieManager ⇄ SecureStore)
// ---------------------------------------------------------------------------

function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/** Copia os cookies atuais de auth.riotgames.com para o SecureStore. */
async function persistCookies(): Promise<boolean> {
  const jar = parseCookieHeader(await RiotCookies.getAsync(AUTH_ORIGIN));
  if (!jar.ssid) return false;
  const names = Object.keys(jar);
  const previous = await readCookieNames();
  for (const name of names) {
    await SecureStore.setItemAsync(secureCookieKey(name), jar[name]);
  }
  for (const stale of previous.filter((n) => !names.includes(n))) {
    await SecureStore.deleteItemAsync(secureCookieKey(stale));
  }
  await SecureStore.setItemAsync(SECURE_COOKIE_NAMES, JSON.stringify(names));
  return true;
}

async function readCookieNames(): Promise<string[]> {
  try {
    return JSON.parse((await SecureStore.getItemAsync(SECURE_COOKIE_NAMES)) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Se o CookieManager perdeu os cookies (ex.: dados da WebView limpos),
 * recoloca os que estão no SecureStore. Não sobrescreve cookies existentes,
 * para não duplicar o ssid rotacionado pela Riot.
 */
async function restoreCookiesIfMissing(): Promise<boolean> {
  const jar = parseCookieHeader(await RiotCookies.getAsync(AUTH_ORIGIN));
  if (jar.ssid) return true;
  const names = await readCookieNames();
  const cookies: string[] = [];
  for (const name of names) {
    const value = await SecureStore.getItemAsync(secureCookieKey(name));
    if (value) cookies.push(`${name}=${value}; Path=/; Secure; HttpOnly`);
  }
  if (!cookies.some((c) => c.startsWith('ssid='))) return false;
  await RiotCookies.setAsync(AUTH_ORIGIN, cookies);
  return true;
}

// ---------------------------------------------------------------------------
// Chamadas de autenticação
// ---------------------------------------------------------------------------

async function fetchEntitlements(accessToken: string): Promise<string> {
  const res = await fetch(ENTITLEMENTS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Falha ao obter entitlements (${res.status}).`);
  const data = (await res.json()) as { entitlements_token: string };
  return data.entitlements_token;
}

async function fetchAccount(accessToken: string, idToken: string): Promise<Account> {
  const [infoRes, geoRes] = await Promise.all([
    fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } }),
    fetch(RIOT_GEO_URL, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    }),
  ]);
  if (!infoRes.ok) throw new Error(`Falha ao ler a conta (${infoRes.status}).`);
  if (!geoRes.ok) throw new Error(`Falha ao descobrir a região (${geoRes.status}).`);
  const info = (await infoRes.json()) as UserInfoResponse;
  const geo = (await geoRes.json()) as RiotGeoResponse;
  return {
    puuid: info.sub,
    shard: shardFromAffinity(geo.affinities.live),
    gameName: info.acct?.game_name || null,
    tagLine: info.acct?.tag_line || null,
  };
}

/** Chamado pela tela de login quando a WebView chega no redirecionamento. */
export async function completeLogin(redirectUrl: string): Promise<Account> {
  const parsed = parseRedirect(redirectUrl);
  if (!parsed) throw new Error('A Riot não devolveu os tokens. Tente entrar de novo.');
  const [entitlementsToken, acc] = await Promise.all([
    fetchEntitlements(parsed.accessToken),
    fetchAccount(parsed.accessToken, parsed.idToken),
  ]);
  tokens = { accessToken: parsed.accessToken, entitlementsToken, expiresAt: parsed.expiresAt };
  account = acc;
  await SecureStore.setItemAsync(SECURE_ACCOUNT, JSON.stringify(acc));
  await persistCookies();
  return acc;
}

/**
 * Renova os tokens usando os cookies (GET /authorize). O fetch do Android
 * segue o redirecionamento e compartilha o cookie jar com a WebView;
 * a URL final traz os tokens no fragmento.
 */
async function reauthenticate(): Promise<Tokens> {
  const hasCookies = await restoreCookiesIfMissing();
  if (!hasCookies) throw new SessionExpiredError();

  let res: Response;
  try {
    res = await fetch(AUTHORIZE_URL, { credentials: 'include' });
  } catch {
    throw new Error('Sem conexão com a Riot. Verifique sua internet.');
  }
  const parsed = res.url ? parseRedirect(res.url) : null;
  if (!parsed) {
    // Redirecionou para a página de login: cookie expirado ou inválido.
    throw new SessionExpiredError();
  }
  const entitlementsToken = await fetchEntitlements(parsed.accessToken);
  // A Riot rotaciona os cookies a cada reauth: guarde os novos.
  await persistCookies();
  return { accessToken: parsed.accessToken, entitlementsToken, expiresAt: parsed.expiresAt };
}

/** Tokens válidos, renovando quando preciso. Lança SessionExpiredError. */
export async function getTokens(force = false): Promise<Tokens> {
  if (!force && tokens && tokens.expiresAt > Date.now()) return tokens;
  if (!reauthInFlight) {
    reauthInFlight = reauthenticate()
      .then((t) => (tokens = t))
      .finally(() => (reauthInFlight = null));
  }
  return reauthInFlight;
}

export async function getAccount(): Promise<Account | null> {
  if (account) return account;
  try {
    const raw = await SecureStore.getItemAsync(SECURE_ACCOUNT);
    account = raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    account = null;
  }
  return account;
}

/** Existe uma sessão salva (pode estar expirada; getTokens confirma). */
export async function hasSavedSession(): Promise<boolean> {
  const acc = await getAccount();
  return !!acc && (await readCookieNames()).includes('ssid');
}

/** Apaga tokens, conta e cookies (SecureStore e CookieManager). */
export async function clearSession(): Promise<void> {
  tokens = null;
  account = null;
  const names = await readCookieNames();
  await Promise.all([
    ...names.map((n) => SecureStore.deleteItemAsync(secureCookieKey(n))),
    SecureStore.deleteItemAsync(SECURE_COOKIE_NAMES),
    SecureStore.deleteItemAsync(SECURE_ACCOUNT),
  ]);
  await RiotCookies.clearAllAsync();
}
