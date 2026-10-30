import { useEffect, useState } from 'react';
import type { TextProps } from 'react-native';

import { formatCountdown } from '@/lib/format';
import { type as typeScale } from '@/theme';

import { Text } from './text';

/** Relógio compartilhado: um único intervalo por componente, de 1 s. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

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
  const now = useNow();
  return (
    <Text variant={variant} color={color} {...props}>
      {prefix}
      {formatCountdown(to - now)}
    </Text>
  );
}
