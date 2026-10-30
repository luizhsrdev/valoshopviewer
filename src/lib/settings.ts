/** Quais avisos a pessoa quer receber. Tudo ligado por padrão. */
import { keys, readJson, writeJson } from './storage';

export type NotifySettings = {
  /** "Sua loja mudou", com as 4 skins. */
  daily: boolean;
  /** Skin da lista de desejos na loja ou no mercado. */
  wishlist: boolean;
  /** Mercado noturno abriu. */
  night: boolean;
};

export const DEFAULT_SETTINGS: NotifySettings = { daily: true, wishlist: true, night: true };

export async function readSettings(): Promise<NotifySettings> {
  return { ...DEFAULT_SETTINGS, ...((await readJson<Partial<NotifySettings>>(keys.notifySettings)) ?? {}) };
}

export async function writeSettings(settings: NotifySettings): Promise<void> {
  await writeJson(keys.notifySettings, settings);
}
