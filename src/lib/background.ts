/**
 * Tarefa periódica (WorkManager, mínimo de 15 min no Android): renova a
 * sessão pelo cookie, atualiza o cache da loja e avisa quando o mercado
 * noturno abre. Precisa ser importado no escopo global (layout raiz).
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { loadContent } from './content';
import { maybeNotifyNightMarket } from './notifications';
import { getAccount, hasSavedSession } from './riot/session';
import { cacheShop, fetchShop } from './shop';
import { isDemoEnabled } from './demo';

export const SHOP_TASK = 'minha-loja.atualizar-loja';

TaskManager.defineTask(SHOP_TASK, async () => {
  try {
    if (await isDemoEnabled()) return BackgroundTask.BackgroundTaskResult.Success;
    if (!(await hasSavedSession())) return BackgroundTask.BackgroundTaskResult.Success;
    const acc = await getAccount();
    if (!acc) return BackgroundTask.BackgroundTaskResult.Success;
    const content = await loadContent();
    const shop = await fetchShop(acc, content);
    await cacheShop(shop);
    await maybeNotifyNightMarket(shop, false);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    // Se a sessão expirou, a próxima abertura do app leva ao login.
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerShopTask() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(SHOP_TASK)) return;
  await BackgroundTask.registerTaskAsync(SHOP_TASK, { minimumInterval: 30 });
}

export async function unregisterShopTask() {
  if (await TaskManager.isTaskRegisteredAsync(SHOP_TASK)) {
    await BackgroundTask.unregisterTaskAsync(SHOP_TASK);
  }
}
