import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors, withAlpha } from '@/theme';

const W = 46;
const H = 28;
const THUMB = 22;
const PAD = (H - THUMB) / 2;
const TRAVEL = W - THUMB - PAD * 2;

/** Mola suave, sem passar do lugar: desliza e assenta. */
const SPRING = { damping: 26, stiffness: 320, mass: 0.9, overshootClamping: true };

/**
 * Interruptor do app. A animação roda na thread de UI (reanimated) e responde
 * na hora ao toque, sem esperar a ida e volta ao nativo do Switch padrão.
 */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange(next: boolean): void;
  accessibilityLabel: string;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.set(reduced ? (value ? 1 : 0) : withSpring(value ? 1 : 0, SPRING));
  }, [value, reduced, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.surfacePressed, colors.accent]),
    borderColor: interpolateColor(progress.get(), [0, 1], [colors.hairlineStrong, colors.accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.get() * TRAVEL }],
    backgroundColor: interpolateColor(progress.get(), [0, 1], [colors.mute, colors.primary]),
  }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: H, borderRadius: H / 2, borderWidth: 1, padding: PAD - 1, justifyContent: 'center' },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    boxShadow: `0 1px 3px ${withAlpha(colors.canvas, 0.5)}`,
  },
});
