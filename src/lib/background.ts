/**
 * Tarefa periódica (WorkManager, mínimo de 15 min no Android; o sistema
 * decide quando roda). Depois da troca da loja, renova a sessão pelo cookie,
 * busca a loja e avisa (loja nova, lista de desejos, mercado noturno).
 * Precisa ser importado no escopo global (layout raiz).
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { loadContent } from './content';
import { fetchDemoShop, readDemo } from './demo';
import { notifyForShop } from './notifications';
import { getAccount, hasSavedSession } from './riot/session';
import { withNightStart } from './night-market';
import { cacheShop, fetchShop, readCachedShop } from './shop';

export const SHOP_TASK = 'minha-loja.atualizar-loja';

/** Mesmo sem troca, busca de vez em quando para pegar o mercado noturno abrindo. */
const MAX_STALE = 3 * 3_600_000;

TaskManager.defineTask(SHOP_TASK, async () => {
  try {
    const demo = await readDemo();
    if (demo?.enabled) {
      // Na demo, roda o mesmo fluxo de avisos com a loja falsa.
      await notifyForShop(await fetchDemoShop(demo), { foreground: false });
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    if (!(await hasSavedSession())) return BackgroundTask.BackgroundTaskResult.Success;
    const acc = await getAccount();
    if (!acc) return BackgroundTask.BackgroundTaskResult.Success;

    const cached = await readCachedShop(acc.puuid);
    const now = Date.now();
    const due = !cached || now >= cached.daily.endsAt || now - cached.fetchedAt >= MAX_STALE;
    if (!due) return BackgroundTask.BackgroundTaskResult.Success;

    const content = await loadContent();
    const shop = await withNightStart(await fetchShop(acc, content)); // renova o token pelo ssid, se preciso
    await cacheShop(shop);
    await notifyForShop(shop, { foreground: false });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    // Sessão expirada ou sem internet: a próxima abertura do app resolve.
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

export async function backgroundStatus(): Promise<'available' | 'restricted'> {
  return (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available
    ? 'available'
    : 'restricted';
}
