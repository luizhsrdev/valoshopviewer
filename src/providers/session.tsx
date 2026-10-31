import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { registerShopTask, unregisterShopTask } from '@/lib/background';
import { acceptConsent, hasCurrentConsent } from '@/lib/consent';
import { readDemo, writeDemo, type DemoState } from '@/lib/demo';
import { clearRevealed } from '@/lib/night-market';
import { cancelDailyReserve, setupNotifications } from '@/lib/notifications';
import { clearSession, getAccount, hasSavedSession, type Account } from '@/lib/riot/session';
import { keys, remove } from '@/lib/storage';

export type SessionStatus = 'loading' | 'consent' | 'signedOut' | 'signedIn';

type SessionContextValue = {
  status: SessionStatus;
  account: Account | null;
  /** Só em desenvolvimento. */
  demo: DemoState | null;
  /** Mensagem mostrada no login quando a sessão expirou. */
  notice: string | null;
  /** Código curto de diagnóstico (sem token/cookie) de por que expirou. Temporário. */
  noticeDiag: string | null;
  accept(): Promise<void>;
  signedIn(account: Account): Promise<void>;
  /** A renovação falhou: volta para o login sem apagar o aceite. */
  expire(diag?: string): Promise<void>;
  signOut(): Promise<void>;
  setDemo(state: DemoState | null): Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [account, setAccount] = useState<Account | null>(null);
  const [demo, setDemoState] = useState<DemoState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeDiag, setNoticeDiag] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!(await hasCurrentConsent())) return setStatus('consent');
      const savedDemo = await readDemo();
      if (savedDemo?.enabled) {
        setDemoState(savedDemo);
        return setStatus('signedIn');
      }
      if (await hasSavedSession()) {
        setAccount(await getAccount());
        setStatus('signedIn');
        registerShopTask().catch(() => {});
        return;
      }
      setStatus('signedOut');
    })();
  }, []);

  const accept = useCallback(async () => {
    await acceptConsent();
    setStatus('signedOut');
  }, []);

  const signedIn = useCallback(async (acc: Account) => {
    setAccount(acc);
    setNotice(null);
    setNoticeDiag(null);
    setStatus('signedIn');
    // Permissão e tarefa em segundo plano não podem travar o login.
    setupNotifications().catch(() => {});
    registerShopTask().catch(() => {});
  }, []);

  const wipe = useCallback(async () => {
    await unregisterShopTask().catch(() => {});
    await clearSession();
    await clearRevealed();
    await remove(keys.shop, keys.nightNotified, keys.dailyNotified, keys.wishlistNotified);
    await cancelDailyReserve();
    setAccount(null);
  }, []);

  const expire = useCallback(
    async (diag?: string) => {
      await wipe();
      setNotice('Sua sessão da Riot expirou. Entre de novo para ver a loja.');
      setNoticeDiag(diag ?? null);
      setStatus('signedOut');
    },
    [wipe],
  );

  const signOut = useCallback(async () => {
    await wipe();
    await writeDemo(null);
    setDemoState(null);
    setNotice(null);
    setNoticeDiag(null);
    setStatus('signedOut');
  }, [wipe]);

  const setDemo = useCallback(async (state: DemoState | null) => {
    if (!__DEV__) return;
    await writeDemo(state);
    setDemoState(state);
    if (state?.enabled) {
      setupNotifications().catch(() => {});
      setStatus('signedIn');
    } else if (!account) {
      setStatus('signedOut');
    }
  }, [account]);

  const value = useMemo(
    () => ({ status, account, demo, notice, noticeDiag, accept, signedIn, expire, signOut, setDemo }),
    [status, account, demo, notice, noticeDiag, accept, signedIn, expire, signOut, setDemo],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error('useSession fora do SessionProvider');
  return ctx;
}
