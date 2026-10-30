import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Armazenamento local para dados não sensíveis (cache da loja, aceite,
 * cartas reveladas). Tokens e cookies ficam no SecureStore (veja riot/session).
 */

export const keys = {
  consent: 'consent',
  content: 'content:v4',
  shop: 'shop:v3',
  nightRevealed: 'night:revealed',
  nightNotified: 'night:notified',
  demo: 'dev:demo',
  wishlist: 'wishlist:v1',
  notifySettings: 'settings:notifications:v1',
  /** Última loja diária avisada (IDs das ofertas). */
  dailyNotified: 'daily:notified',
  /** Última combinação de desejos avisada. */
  wishlistNotified: 'wishlist:notified',
} as const;

/** Chaves de versões antigas do cache, apagadas quando o formato muda. */
export const legacyKeys = ['content:v1', 'content:v2', 'content:v3', 'shop:v1', 'shop:v2'];

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache é opcional: falhar aqui não pode quebrar o app.
  }
}

export async function remove(...k: string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(k);
  } catch {}
}
