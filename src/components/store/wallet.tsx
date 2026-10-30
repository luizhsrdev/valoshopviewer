import { StyleSheet, View } from 'react-native';

import { formatNumber } from '@/lib/format';
import type { Shop } from '@/lib/shop';
import { colors, space } from '@/theme';

import { Text } from '../text';

const ITEMS = [
  { key: 'vp', label: 'VP', a11y: 'Valorant Points' },
  { key: 'rad', label: 'RAD', a11y: 'Radianita' },
  { key: 'kc', label: 'KC', a11y: 'Kingdom Credits' },
] as const;

/** Saldo discreto: rótulo em texto (sem ícones oficiais) + número tabular. */
export function Wallet({ wallet }: { wallet: Shop['wallet'] }) {
  if (!wallet) return null;
  return (
    <View style={styles.row}>
      {ITEMS.map((i) => (
        <View
          key={i.key}
          style={styles.item}
          accessible
          accessibilityLabel={`${formatNumber(wallet[i.key])} ${i.a11y}`}>
          <Text variant="micro" color={colors.ash}>
            {i.label}
          </Text>
          <Text variant="numeric" color={colors.mute} style={styles.value}>
            {formatNumber(wallet[i.key])}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  item: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  value: { fontSize: 13 },
});
