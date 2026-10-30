/**
 * Avisos locais (nada passa por servidor):
 * - "Sua loja mudou", com as 4 skins;
 * - em destaque, skin da lista de desejos na loja ou no mercado noturno;
 * - mercado noturno aberto.
 *
 * Cada loja é avisada uma vez só (chaves no AsyncStorage). Como o Android não
 * garante quando a tarefa em segundo plano roda, também deixamos agendado um
 * aviso de reserva para cada uma das próximas trocas (sempre 00:00 UTC). Se a
 * tarefa chega antes, cancela a reserva daquele dia e manda os nomes; se a
 * reserva já tocou, a tarefa não repete o aviso.
 */
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

import { colors } from '@/theme';

import { formatNumber } from './format';
import { claimNotification } from './night-market';
import { readSettings } from './settings';
import type { Shop } from './shop';
import { keys, readJson, writeJson } from './storage';
import { readWishlist } from './wishlist';

export const CHANNEL_ID = 'loja';
export const WISHLIST_CHANNEL_ID = 'desejos';
export const NIGHT_MARKET_ROUTE = '/mercado';
const STORE_ROUTE = '/';
const RESERVE_PREFIX = 'reserva-loja-';
/** Quantas trocas futuras ficam com aviso de reserva agendado. */
const RESERVE_DAYS = 7;
const DAY = 86_400_000;
/** A reserva toca 1 min depois da troca (00:00 UTC). */
const RESERVE_DELAY = 60_000;
const reserveId = (resetAt: number) => `${RESERVE_PREFIX}${resetAt}`;
/** Horários de troca que tiveram reserva agendada (para saber se ela já tocou). */
const RESERVED_KEY = 'daily:reserved';

type Kind = 'daily' | 'daily-reserve' | 'wishlist' | 'night' | 'test';

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    // Com o app aberto, a própria tela já mostra a loja e o mercado.
    const kind = n.request.content.data?.kind as Kind | undefined;
    const quiet = AppState.currentState === 'active' && (kind === 'daily' || kind === 'daily-reserve' || kind === 'night');
    return { shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: !quiet, shouldShowList: !quiet };
  },
});

export async function setupNotifications(): Promise<boolean> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Loja e mercado noturno',
    // eslint-disable-next-line import/namespace -- exportado via `export *` (falso positivo)
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.accent,
  });
  await Notifications.setNotificationChannelAsync(WISHLIST_CHANNEL_ID, {
    name: 'Lista de desejos',
    description: 'Quando uma skin da sua lista aparece na loja ou no mercado noturno.',
    // eslint-disable-next-line import/namespace -- exportado via `export *` (falso positivo)
    importance: Notifications.AndroidImportance.MAX,
    lightColor: colors.accent,
  });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function notificationsAllowed(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

async function send(
  kind: Kind,
  content: { title: string; body: string; url: string },
  channelId = CHANNEL_ID,
  delaySeconds?: number,
) {
  await Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body, data: { url: content.url, kind }, color: colors.accent },
    trigger: delaySeconds
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds, channelId }
      : { channelId },
  });
}

function formatRemaining(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  return d >= 1 ? `${d} dia${d > 1 ? 's' : ''}` : `${Math.max(h, 1)} h`;
}

export async function notifyNightMarket(endsAt: number, delaySeconds?: number) {
  await send(
    'night',
    {
      title: 'Mercado noturno aberto',
      body: `Seis cartas esperando por você. Termina em ${formatRemaining(endsAt - Date.now())}.`,
      url: NIGHT_MARKET_ROUTE,
    },
    CHANNEL_ID,
    delaySeconds,
  );
}

const dailyKey = (shop: Shop) =>
  shop.daily.offers
    .map((o) => o.id)
    .sort()
    .join('|');

type Hit = { name: string; where: 'daily' | 'night'; price: number; discount?: number; id: string };

function wishlistHits(shop: Shop, wishlist: Set<string>, now: number): Hit[] {
  const hits: Hit[] = [];
  for (const o of shop.daily.offers) {
    if (o.skinUuid && wishlist.has(o.skinUuid)) hits.push({ name: o.name, where: 'daily', price: o.price, id: o.id });
  }
  if (shop.night && shop.night.endsAt > now) {
    for (const o of shop.night.offers) {
      if (o.skinUuid && wishlist.has(o.skinUuid)) {
        hits.push({ name: o.name, where: 'night', price: o.finalPrice, discount: o.discountPercent, id: o.id });
      }
    }
  }
  return hits;
}

function wishlistMessage(hits: Hit[]) {
  const onlyNight = hits.every((h) => h.where === 'night');
  const url = onlyNight ? NIGHT_MARKET_ROUTE : STORE_ROUTE;
  if (hits.length === 1) {
    const h = hits[0]!;
    return {
      title: `${h.name} está ${h.where === 'night' ? 'no seu mercado noturno' : 'na sua loja'}!`,
      body:
        h.where === 'night'
          ? `Da sua lista de desejos, com ${h.discount}% de desconto: ${formatNumber(h.price)} VP.`
          : `Da sua lista de desejos, hoje por ${formatNumber(h.price)} VP.`,
      url,
    };
  }
  return {
    title: `${hits.length} skins da sua lista de desejos apareceram!`,
    body: hits.map((h) => `${h.name} (${h.where === 'night' ? 'mercado' : 'loja'})`).join(', '),
    url,
  };
}

/**
 * Decide e envia os avisos de uma loja recém-buscada. Em primeiro plano só
 * marca como avisado (a tela já mostra tudo). `delaySeconds` é para testes.
 */
export async function notifyForShop(shop: Shop, opts: { foreground: boolean; delaySeconds?: number }) {
  const now = Date.now();
  const settings = await readSettings();
  const silent = opts.foreground;

  // 1. Lista de desejos (em destaque, canal próprio).
  const hits = wishlistHits(shop, await readWishlist(), now);
  if (hits.length) {
    const key = hits
      .map((h) => h.id)
      .sort()
      .join('|');
    if ((await readJson<string>(keys.wishlistNotified)) !== key) {
      await writeJson(keys.wishlistNotified, key);
      if (!silent && settings.wishlist) await send('wishlist', wishlistMessage(hits), WISHLIST_CHANNEL_ID, opts.delaySeconds);
    }
  }

  // 2. Loja diária nova.
  const key = dailyKey(shop);
  if ((await readJson<string>(keys.dailyNotified)) !== key) {
    await writeJson(keys.dailyNotified, key);
    // A troca que gerou esta loja foi 24 h antes da próxima. Se a reserva dela
    // já tocou, não repete; senão, cancela a reserva e manda os nomes.
    const resetAt = shop.daily.endsAt - DAY;
    const reserved = (await readJson<number[]>(RESERVED_KEY)) ?? [];
    const reserveFired = settings.daily && reserved.includes(resetAt) && now >= resetAt + RESERVE_DELAY;
    if (!reserveFired) await Notifications.cancelScheduledNotificationAsync(reserveId(resetAt)).catch(() => {});
    if (!silent && settings.daily && !reserveFired) {
      await send(
        'daily',
        { title: 'Sua loja mudou', body: shop.daily.offers.map((o) => o.name).join(' · '), url: STORE_ROUTE },
        CHANNEL_ID,
        opts.delaySeconds,
      );
    }
  }

  // 3. Mercado noturno.
  if (shop.night && shop.night.endsAt > now) {
    const isNew = await claimNotification(shop.night);
    if (isNew && !silent && settings.night) await notifyNightMarket(shop.night.endsAt, opts.delaySeconds);
  }

  await scheduleDailyReserve(shop, settings.daily);
}

/**
 * Reserva: avisos locais agendados para as próximas trocas (00:00 UTC, todo
 * dia). Garantem o aviso mesmo se o Android não rodar a tarefa a tempo.
 */
export async function scheduleDailyReserve(shop: Shop, enabled: boolean) {
  if (!enabled) return cancelDailyReserve();
  const scheduled = new Set((await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier));
  const reserved = new Set((await readJson<number[]>(RESERVED_KEY)) ?? []);
  for (let k = 0; k < RESERVE_DAYS; k++) {
    const resetAt = shop.daily.endsAt + k * DAY;
    const id = reserveId(resetAt);
    if (scheduled.has(id) || resetAt + RESERVE_DELAY <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: 'Sua loja mudou',
        body: 'Quatro skins novas. Toque para ver.',
        data: { url: STORE_ROUTE, kind: 'daily-reserve' },
        color: colors.accent,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(resetAt + RESERVE_DELAY),
        channelId: CHANNEL_ID,
      },
    });
    reserved.add(resetAt);
  }
  // Guarda só as dos últimos dias.
  const cutoff = Date.now() - 2 * DAY;
  await writeJson(RESERVED_KEY, [...reserved].filter((t) => t >= cutoff));
}

export async function cancelDailyReserve() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(RESERVE_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
  await writeJson(RESERVED_KEY, []);
}

/** Para os testes do painel de desenvolvimento: esquece o que já foi avisado. */
export async function resetNotified() {
  await writeJson(keys.dailyNotified, null);
  await writeJson(keys.wishlistNotified, null);
  await writeJson(keys.nightNotified, null);
}
