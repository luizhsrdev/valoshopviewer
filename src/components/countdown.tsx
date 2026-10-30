import { useIsFocused } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { AppState, type TextProps } from 'react-native';

import { formatCountdown } from '@/lib/format';
import { type as typeScale } from '@/theme';

import { Text } from './text';

/**
 * Relógios compartilhados: um único timer por intervalo para o app inteiro,
 * alinhado à virada do segundo e pausado com o app em segundo plano.
 * (Antes, cada contagem tinha o próprio setInterval.)
 */
type Ticker = { now: number; listeners: Set<() => void>; timer: ReturnType<typeof setTimeout> | null };
const tickers = new Map<number, Ticker>();

function getTicker(intervalMs: number): Ticker {
  let t = tickers.get(intervalMs);
  if (!t) {
    t = { now: Date.now(), listeners: new Set(), timer: null };
    tickers.set(intervalMs, t);
  }
  return t;
}

function schedule(intervalMs: number, t: Ticker) {
  if (t.timer || t.listeners.size === 0 || AppState.currentState !== 'active') return;
  // Alinha à próxima virada do intervalo, para todas as contagens mudarem juntas.
  const delay = intervalMs - (Date.now() % intervalMs) + 5;
  t.timer = setTimeout(() => {
    t.timer = null;
    t.now = Date.now();
    t.listeners.forEach((l) => l());
    schedule(intervalMs, t);
  }, delay);
}

AppState.addEventListener('change', (state) => {
  tickers.forEach((t, intervalMs) => {
    if (state === 'active') {
      t.now = Date.now();
      t.listeners.forEach((l) => l());
      schedule(intervalMs, t);
    } else if (t.timer) {
      clearTimeout(t.timer);
      t.timer = null;
    }
  });
});

function subscribe(intervalMs: number) {
  return (listener: () => void) => {
    const t = getTicker(intervalMs);
    // Quem volta a observar recebe a hora atual (o relógio pode ter ficado parado).
    t.now = Date.now();
    t.listeners.add(listener);
    schedule(intervalMs, t);
    return () => {
      t.listeners.delete(listener);
      if (t.listeners.size === 0 && t.timer) {
        clearTimeout(t.timer);
        t.timer = null;
      }
    };
  };
}

const subscribers = new Map<number, (l: () => void) => () => void>();
const getSubscribe = (ms: number) => {
  let s = subscribers.get(ms);
  if (!s) subscribers.set(ms, (s = subscribe(ms)));
  return s;
};

/** Hora atual, atualizada a cada `intervalMs` pelo relógio compartilhado. */
export function useNow(intervalMs = 1000) {
  return useSyncExternalStore(getSubscribe(intervalMs), () => getTicker(intervalMs).now);
}

const noop = () => () => {};

export function Countdown({
  to,
  prefix = '',
  color,
  variant = 'numeric',
  ...props
}: TextProps & {
  to: number;
  prefix?: string;
  color?: string;
  variant?: keyof typeof typeScale;
}) {
  // Fora de foco (tela escondida na pilha) não atualiza. Com mais de um dia
  // restante o texto é "3d 06h", então basta atualizar a cada minuto.
  const focused = useIsFocused();
  const coarse = useSyncExternalStore(focused ? getSubscribe(60_000) : noop, () => getTicker(60_000).now);
  const needSeconds = to - coarse <= 86_400_000;
  const fine = useSyncExternalStore(focused && needSeconds ? getSubscribe(1000) : noop, () => getTicker(1000).now);
  const now = needSeconds ? Math.max(fine, coarse) : coarse;
  return (
    <Text variant={variant} color={color} {...props}>
      {prefix}
      {formatCountdown(to - now)}
    </Text>
  );
}
