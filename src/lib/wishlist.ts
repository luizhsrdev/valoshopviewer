/** Lista de desejos: UUIDs de skins, salvos só no celular. */
import { keys, readJson, writeJson } from './storage';

export async function readWishlist(): Promise<Set<string>> {
  return new Set((await readJson<string[]>(keys.wishlist)) ?? []);
}

export async function writeWishlist(ids: Set<string>): Promise<void> {
  await writeJson(keys.wishlist, [...ids]);
}
