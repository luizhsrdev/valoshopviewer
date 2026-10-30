/**
 * Estado do mercado noturno salvo no aparelho: quais cartas já foram reveladas
 * e se já avisamos sobre este mercado. Tudo expira junto com o mercado.
 */
import type { Shop } from './shop';
import { keys, readJson, writeJson } from './storage';

type Revealed = { endsAt: number; ids: string[] };

/** Identifica um mercado específico (as ofertas mudam a cada mercado). */
export function marketKey(night: NonNullable<Shop['night']>): string {
  return night.offers
    .map((o) => o.id)
    .sort()
    .join('|');
}

export async function readRevealed(now = Date.now()): Promise<Set<string>> {
  const saved = await readJson<Revealed>(keys.nightRevealed);
  if (!saved || saved.endsAt <= now) return new Set();
  return new Set(saved.ids);
}

export async function saveRevealed(ids: Set<string>, endsAt: number): Promise<void> {
  await writeJson(keys.nightRevealed, { endsAt, ids: [...ids] } satisfies Revealed);
}

export async function clearRevealed(): Promise<void> {
  await writeJson(keys.nightRevealed, null);
}

/** true se este mercado ainda não foi avisado (e já marca como avisado). */
export async function claimNotification(night: NonNullable<Shop['night']>): Promise<boolean> {
  const key = marketKey(night);
  const last = await readJson<string>(keys.nightNotified);
  if (last === key) return false;
  await writeJson(keys.nightNotified, key);
  return true;
}
