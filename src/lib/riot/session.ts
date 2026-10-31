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
import { safeFetch } from '../net';
import { AUTH_ORIGIN, ENTITLEMENTS_URL, REDIRECT_PREFIX, RIOT_GEO_URL, shardFromAffinity, USERINFO_URL } from './constants';
import type { RiotGeoResponse, UserInfoResponse } from './types';

/** "Nome#TAG" da conta, para mostrar na tela (loja, cartões de compartilhar etc.). */
export function playerLabel(account: Account | null, demoEnabled: boolean): string {
  if (demoEnabled) return 'Modo demonstração';
  if (account?.gameName) return `${account.gameName}#${account.tagLine ?? ''}`;
  return 'Minha Loja';
}

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
  /**
   * Código curto e seguro (sem token/cookie) de qual etapa falhou, só para
   * diagnóstico — mostrado na tela de login para o usuário relatar.
   * TODO(2026-10-31): remover depois de confirmar a causa do "sempre pede
   * login de novo" relatado no primeiro teste com conta real.
   */
  constructor(public readonly reason: string) {
    super('Sua sessão da Riot expirou. Entre de novo.');
    this.name = 'SessionExpiredError';
  }
}

const SECURE_ACCOUNT = 'riot.account';
const SECURE_TOKENS = 'riot.tokens';
const SECURE_COOKIE_NAMES = 'riot.cookie.names';
const secureCookieKey = (name: string) => `riot.cookie.${name.replace(/[^A-Za-z0-9._-]/g, '_')}`;

let tokens: Tokens | null = null;
let account: Account | null = null;
let reauthInFlight: Promise<Tokens> | null = null;

/**
 * Ponte para a WebView invisível de renovação (montada em `_layout.tsx`;
 * registrada por `SilentReauthWebView`). `null` quando não há tela montada —
 * é sempre o caso na tarefa em segundo plano, que roda sem UI.
 */
export type ReauthBridge = { reauth(): Promise<string> };
let reauthBridge: ReauthBridge | null = null;
export function setReauthBridge(bridge: ReauthBridge | null) {
  reauthBridge = bridge;
}

async function saveTokens(t: Tokens): Promise<void> {
  await SecureStore.setItemAsync(SECURE_TOKENS, JSON.stringify(t));
}

/** Token salvo da última renovação (foreground), se ainda não tiver vencido. */
async function readSavedTokens(): Promise<Tokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_TOKENS);
    if (!raw) return null;
    const t = JSON.parse(raw) as Tokens;
    return t.expiresAt > Date.now() ? t : null;
  } catch {
    return null;
  }
}

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
 * Se o CookieManager perdeu os cookies (ex.: processo do Android encerrado),
 * recoloca os que estão no SecureStore. Não sobrescreve cookies existentes,
 * para não duplicar o ssid rotacionado pela Riot.
 *
 * `diag` conta de onde veio o ssid, para saber qual das duas pontas falhou
 * quando a sessão expira sem motivo aparente.
 */
async function restoreCookiesIfMissing(): Promise<{ ok: boolean; diag: string }> {
  const jar = parseCookieHeader(await RiotCookies.getAsync(AUTH_ORIGIN));
  if (jar.ssid) return { ok: true, diag: 'cookiemanager' };
  const names = await readCookieNames();
  const cookies: string[] = [];
  for (const name of names) {
    const value = await SecureStore.getItemAsync(secureCookieKey(name));
    if (value) cookies.push(`${name}=${value}; Path=/; Secure; HttpOnly`);
  }
  if (!cookies.some((c) => c.startsWith('ssid='))) {
    return { ok: false, diag: `sem-backup:nomes=${names.length}:achados=${cookies.length}` };
  }
  await RiotCookies.setAsync(AUTH_ORIGIN, cookies);
  return { ok: true, diag: 'securestore' };
}

// ---------------------------------------------------------------------------
// Chamadas de autenticação
// ---------------------------------------------------------------------------

async function fetchEntitlements(accessToken: string): Promise<string> {
  const res = await safeFetch(ENTITLEMENTS_URL, {
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
    safeFetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } }),
    safeFetch(RIOT_GEO_URL, {
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
  await Promise.all([persistCookies(), saveTokens(tokens)]);
  return acc;
}

/**
 * Renova pela WebView invisível (não pelo `fetch`): o token vem no
 * **fragmento** do link de redirecionamento, que por definição nunca é
 * enviado a um servidor — só um motor de navegador consegue lê-lo antes de
 * visitar o link. Testado com conta real em 2026-10-31: o `fetch` chegava a
 * `playvalorant.com/opt_in`, mas sem o fragmento (a Riot nem chega a ver essa
 * parte do link, então não é um redirecionamento "errado"; o servidor dela
 * devolve 404 para esse link sem fragmento, igual devolveria para qualquer
 * navegador comum). Ver PROJETO.md para o diagnóstico completo.
 */
async function reauthenticate(): Promise<Tokens> {
  const restored = await restoreCookiesIfMissing();
  if (!restored.ok) throw new SessionExpiredError(`restore:${restored.diag}`);

  if (!reauthBridge) {
    // Sem tela montada (ex.: tarefa em segundo plano): não dá para abrir uma
    // WebView. getTokens() já tenta o token salvo antes de chegar aqui.
    throw new SessionExpiredError('sem-webview');
  }

  let url: string;
  try {
    url = await reauthBridge.reauth();
  } catch (reason) {
    if (reason === 'cookie-invalido') throw new SessionExpiredError('webview:cookie-invalido');
    throw new Error('Sem conexão com a Riot. Verifique sua internet.');
  }
  const parsed = parseRedirect(url);
  if (!parsed) throw new SessionExpiredError(`webview:sem-token:hash=${url.includes('#')}`);

  const entitlementsToken = await fetchEntitlements(parsed.accessToken);
  const next = { accessToken: parsed.accessToken, entitlementsToken, expiresAt: parsed.expiresAt };
  // A Riot rotaciona os cookies a cada reauth: guarde os novos, e o token
  // (para a tarefa em segundo plano poder reaproveitá-lo sem abrir WebView).
  await Promise.all([persistCookies(), saveTokens(next)]);
  return next;
}

/** Tokens válidos, renovando quando preciso. Lança SessionExpiredError. */
export async function getTokens(force = false): Promise<Tokens> {
  if (!force && tokens && tokens.expiresAt > Date.now()) return tokens;
  // Processo novo (ex.: tarefa em segundo plano, sem WebView disponível):
  // o token da última renovação em primeiro plano pode ainda valer.
  if (!force && !tokens) {
    const saved = await readSavedTokens();
    if (saved) return (tokens = saved);
  }
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
    SecureStore.deleteItemAsync(SECURE_TOKENS),
  ]);
  await RiotCookies.clearAllAsync();
}
