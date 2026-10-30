/**
 * Ordem das armas no filtro do catálogo, escolhida pela pessoa (arrastar e
 * esconder). Guarda UUIDs; armas novas que surgirem num patch entram no fim.
 */
import type { WeaponInfo } from './content';
import { keys, readJson, writeJson } from './storage';

export type WeaponPrefs = { order: string[]; hidden: string[] };

export type OrderedWeapon = WeaponInfo & { index: number };

export async function readWeaponPrefs(): Promise<WeaponPrefs | null> {
  return readJson<WeaponPrefs>(keys.weaponPrefs);
}

export async function writeWeaponPrefs(prefs: WeaponPrefs | null): Promise<void> {
  await writeJson(keys.weaponPrefs, prefs);
}

/** Aplica as preferências à lista do catálogo (que já vem na ordem padrão). */
export function applyWeaponPrefs(weapons: WeaponInfo[], prefs: WeaponPrefs | null) {
  const all: OrderedWeapon[] = weapons.map((w, index) => ({ ...w, index }));
  if (!prefs) return { visible: all, hidden: [] as OrderedWeapon[] };
  const pos = new Map(prefs.order.map((id, i) => [id, i]));
  const hidden = new Set(prefs.hidden);
  const sorted = [...all].sort(
    (a, b) => (pos.get(a.uuid) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.uuid) ?? Number.MAX_SAFE_INTEGER) || a.index - b.index,
  );
  return { visible: sorted.filter((w) => !hidden.has(w.uuid)), hidden: sorted.filter((w) => hidden.has(w.uuid)) };
}
