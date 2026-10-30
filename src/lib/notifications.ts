import * as Notifications from 'expo-notifications';

import { colors } from '@/theme';

import { claimNotification } from './night-market';
import type { Shop } from './shop';

export const CHANNEL_ID = 'loja';
export const NIGHT_MARKET_ROUTE = '/mercado';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Loja e mercado noturno',
    // eslint-disable-next-line import/namespace -- exportado via `export *` (falso positivo)
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.accent,
  });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function formatRemaining(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  return d >= 1 ? `${d} dia${d > 1 ? 's' : ''}` : `${Math.max(h, 1)} h`;
}

export async function notifyNightMarket(endsAt: number, delaySeconds?: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Mercado noturno aberto',
      body: `Seis cartas esperando por você. Termina em ${formatRemaining(endsAt - Date.now())}.`,
      data: { url: NIGHT_MARKET_ROUTE },
      color: colors.accent,
    },
    trigger: delaySeconds
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delaySeconds,
          channelId: CHANNEL_ID,
        }
      : { channelId: CHANNEL_ID },
  });
}

/**
 * Avisa uma única vez por mercado. Em primeiro plano não notifica (o banner já
 * aparece na loja), só marca como avisado.
 */
export async function maybeNotifyNightMarket(shop: Shop, inForeground: boolean) {
  if (!shop.night || shop.night.endsAt <= Date.now()) return;
  const isNew = await claimNotification(shop.night);
  if (isNew && !inForeground) await notifyNightMarket(shop.night.endsAt);
}
