import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { loadContent } from '@/lib/content';
import { DEMO_PUUID, fetchDemoShop } from '@/lib/demo';
import { maybeNotifyNightMarket } from '@/lib/notifications';
import { SessionExpiredError } from '@/lib/riot/session';
import { cacheShop, fetchShop, readCachedShop, type Shop } from '@/lib/shop';

import { useSession } from './session';

type ShopContextValue = {
  shop: Shop | null;
  /** Primeira carga sem nada em cache: mostra skeleton. */
  loading: boolean;
  /** Atualizando por trás (cache visível). */
  refreshing: boolean;
  error: string | null;
  refresh(): Promise<void>;
};

const ShopContext = createContext<ShopContextValue | null>(null);

/** Próximo momento em que algo da loja troca (diária, mercado ou pacote). */
function nextChangeAt(shop: Shop): number {
  const times = [shop.daily.endsAt, ...shop.bundles.map((b) => b.endsAt)];
  if (shop.night) times.push(shop.night.endsAt);
  return Math.min(...times.filter((t) => t > shop.fetchedAt));
}

function messageFor(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'Não foi possível carregar a loja. Tente de novo.';
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { account, demo, expire } = useSession();
  const puuid = demo?.enabled ? DEMO_PUUID : (account?.puuid ?? null);
  // Indexado pela conta: ao trocar de conta (ou ligar a demo) começa vazio.
  const [state, setState] = useState<{ owner: string | null; shop: Shop | null; error: string | null }>({
    owner: null,
    shop: null,
    error: null,
  });
  const [fetching, setFetching] = useState(false);
  const inFlight = useRef<Promise<void> | null>(null);
  // Muda quando a conta/demo muda; respostas de uma geração antiga são descartadas.
  const generation = useRef(0);
  const shopRef = useRef<Shop | null>(null);

  const mine = state.owner === puuid;
  const shop = mine ? state.shop : null;
  const error = mine ? state.error : null;
  useEffect(() => {
    shopRef.current = shop;
  }, [shop]);

  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const gen = generation.current;
    const stale = () => gen !== generation.current;
    const run = (async () => {
      setFetching(true);
      try {
        let next: Shop;
        if (demo?.enabled) {
          next = await fetchDemoShop(demo);
        } else {
          if (!account) return;
          const content = await loadContent();
          next = await fetchShop(account, content);
          if (stale()) return;
          await cacheShop(next);
        }
        if (stale()) return;
        setState({ owner: puuid, shop: next, error: null });
        await maybeNotifyNightMarket(next, AppState.currentState === 'active');
      } catch (e) {
        if (stale()) return;
        if (e instanceof SessionExpiredError) {
          await expire();
          return;
        }
        const message = messageFor(e);
        setState((prev) => ({ owner: puuid, shop: prev.owner === puuid ? prev.shop : null, error: message }));
      } finally {
        // Numa geração antiga, a nova já reiniciou o estado.
        if (!stale()) {
          inFlight.current = null;
          setFetching(false);
        }
      }
    })();
    inFlight.current = run;
    return run;
  }, [account, demo, expire, puuid]);

  // Abre instantâneo com o cache e atualiza por trás.
  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    inFlight.current = null;
    (async () => {
      if (puuid && puuid !== DEMO_PUUID) {
        const cached = await readCachedShop(puuid);
        if (!cancelled && cached) {
          setState((prev) => (prev.owner === puuid && prev.shop ? prev : { owner: puuid, shop: cached, error: null }));
        }
      }
      if (!cancelled) refresh();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puuid, demo?.seed, demo?.night]);

  // Atualiza sozinho quando a contagem zera.
  useEffect(() => {
    if (!shop) return;
    const delay = nextChangeAt(shop) - Date.now() + 2_000;
    if (!Number.isFinite(delay)) return;
    const id = setTimeout(() => refresh(), Math.max(delay, 1_000));
    return () => clearTimeout(id);
  }, [shop, refresh]);

  // Ao voltar para o primeiro plano depois de uma troca, atualiza.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const current = shopRef.current;
      if (state === 'active' && current && Date.now() >= nextChangeAt(current)) refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(
    () => ({
      shop,
      loading: !shop && (fetching || !error),
      refreshing: !!shop && fetching,
      error,
      refresh,
    }),
    [shop, fetching, error, refresh],
  );
  return <ShopContext value={value}>{children}</ShopContext>;
}

export function useShop() {
  const ctx = use(ShopContext);
  if (!ctx) throw new Error('useShop fora do ShopProvider');
  return ctx;
}
