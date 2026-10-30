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

/**
 * Início do mercado: a Riot só informa o fim, então guardamos quando este
 * mercado (identificado pelas ofertas) apareceu pela primeira vez.
 */
export async function withNightStart(shop: Shop, now = Date.now()): Promise<Shop> {
  if (!shop.night || shop.night.startedAt) return shop;
  const key = marketKey(shop.night);
  const starts = (await readJson<Record<string, number>>(keys.nightStarts)) ?? {};
  let startedAt = starts[key];
  if (!startedAt) {
    startedAt = now;
    // Guarda só o mercado atual (só existe um por vez), para não crescer.
    const kept: Record<string, number> = { [key]: startedAt };
    await writeJson(keys.nightStarts, kept);
  }
  return { ...shop, night: { ...shop.night, startedAt } };
}

/** Balão "mercado disponível": aparece num mercado novo e, depois, no máximo a cada `everyMs`. */
export async function shouldShowNightCallout(night: NonNullable<Shop['night']>, everyMs: number, now = Date.now()) {
  const last = await readJson<{ key: string; at: number }>(keys.nightCallout);
  const key = marketKey(night);
  return !last || last.key !== key || now - last.at >= everyMs;
}

export async function markNightCallout(night: NonNullable<Shop['night']>, now = Date.now()) {
  await writeJson(keys.nightCallout, { key: marketKey(night), at: now });
}

/** A pessoa já abriu este mercado? (o ponto vermelho do ícone some depois do 1º acesso) */
export async function wasNightSeen(night: NonNullable<Shop['night']>): Promise<boolean> {
  return (await readJson<string>(keys.nightSeen)) === marketKey(night);
}

export async function markNightSeen(night: NonNullable<Shop['night']>): Promise<void> {
  await writeJson(keys.nightSeen, marketKey(night));
}

/** true se este mercado ainda não foi avisado (e já marca como avisado). */
export async function claimNotification(night: NonNullable<Shop['night']>): Promise<boolean> {
  const key = marketKey(night);
  const last = await readJson<string>(keys.nightNotified);
  if (last === key) return false;
  await writeJson(keys.nightNotified, key);
  return true;
}
