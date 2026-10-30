import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, space } from '@/theme';

import { Countdown } from '../countdown';
import { Text } from '../text';

/** Único lugar onde o mercado aparece na loja: um atalho para a tela dele. */
export function NightMarketBanner({ endsAt, onPress }: { endsAt: number; onPress(): void }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.8 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Mercado noturno disponível. Abrir o mercado."
      style={({ pressed }) => [styles.box, pressed && { backgroundColor: colors.surfacePressed }]}>
      <View style={styles.dotWrap}>
        <Animated.View style={[styles.halo, halo]} />
        <View style={styles.dot} />
      </View>
      <View style={styles.texts}>
        <Text variant="bodyStrong" color={colors.ink}>
          Mercado noturno disponível
        </Text>
        <Countdown to={endsAt} prefix="Termina em " variant="caption" color={colors.mute} />
      </View>
      <Text variant="label" color={colors.ink}>
        Abrir ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  texts: { flex: 1, gap: 2 },
});
