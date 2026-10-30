import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, radius, space, withAlpha } from '@/theme';

import { Countdown } from '../countdown';
import { Text } from '../text';

/** Quanto tempo o balão fica na tela antes de sumir sozinho. */
const VISIBLE_MS = 6000;
const ARROW = 8;
/** Mola discreta: cresce rápido e passa só um fio do tamanho final. */
const OPEN_SPRING = { damping: 22, stiffness: 260, mass: 0.8 };
const CLOSE_TIMING = { duration: 140, easing: Easing.in(Easing.quad) };
/** Escala inicial: cresce pouco a partir do ícone, sem "explodir". */
const FROM_SCALE = 0.7;

/**
 * Balão "Mercado noturno disponível · termina em …" que nasce de dentro do
 * ícone do mercado (a ponta da seta) e se expande; ao fechar, volta para ele.
 *
 * `open` controla a animação; quando ela termina de fechar, chama `onClosed`
 * para o pai desmontar. `arrowRight`: distância da borda direita do balão até
 * o centro do ícone.
 */
export function NightMarketCallout({
  open,
  endsAt,
  arrowRight,
  onPress,
  onDismiss,
  onClosed,
  onTouchInside,
}: {
  open: boolean;
  endsAt: number;
  arrowRight: number;
  onPress(): void;
  /** Pede para fechar (tempo esgotado). */
  onDismiss(): void;
  /** A animação de fechar terminou. */
  onClosed(): void;
  /** Avisa que o toque começou dentro do balão (para "tocar fora fecha" ignorá-lo). */
  onTouchInside(): void;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!width) return; // espera medir, para a origem da expansão ficar certa
    if (open) {
      progress.set(reduced ? 1 : withSpring(1, OPEN_SPRING));
      const id = setTimeout(() => onDismiss(), VISIBLE_MS);
      return () => clearTimeout(id);
    }
    if (reduced) {
      progress.set(0);
      onClosed();
      return;
    }
    progress.set(
      withTiming(0, CLOSE_TIMING, (done) => {
        if (done) scheduleOnRN(onClosed);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, width, reduced]);

  // Origem da expansão: a ponta da seta, logo abaixo do ícone.
  const originX = width ? ((width - arrowRight) / width) * 100 : 100;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, [0, 0.6], [0, 1], 'clamp'),
      transform: [{ scale: FROM_SCALE + (1 - FROM_SCALE) * p }],
    };
  });

  return (
    <Animated.View
      style={[styles.wrap, { transformOrigin: `${originX}% 0%` }, style]}
      pointerEvents={open ? 'box-none' : 'none'}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onTouchStart={onTouchInside}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.box, pressed && { backgroundColor: colors.surfacePressed }]}
        accessibilityRole="button"
        accessibilityLabel="Mercado noturno disponível. Abrir o mercado."
        accessibilityLiveRegion="polite">
        <View style={styles.dot} />
        <View style={{ gap: 1 }}>
          <Text variant="label" color={colors.ink}>
            Mercado noturno disponível
          </Text>
          <Countdown to={endsAt} prefix="Termina em " variant="caption" color={colors.mute} />
        </View>
        <Text variant="label" color={colors.ink} style={styles.open}>
          Abrir ›
        </Text>
      </Pressable>
      {/* Depois do balão: a metade de baixo cobre a borda dele, sem emenda. */}
      <View style={[styles.arrow, { right: Math.max(radius.lg, arrowRight - ARROW) }]} pointerEvents="none" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // `right: space.sm` desfaz o deslocamento da fileira de ícones: alinha à margem da loja.
  wrap: { position: 'absolute', top: '100%', right: space.sm, marginTop: space.xs, alignItems: 'flex-end', zIndex: 20 },
  // Seta: quadrado girado; só as bordas de cima/esquerda aparecem, apontando para o ícone.
  arrow: {
    position: 'absolute',
    top: -ARROW + 1,
    width: ARROW * 2,
    height: ARROW * 2,
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.hairlineStrong,
    transform: [{ rotate: '45deg' }],
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceElevated,
    boxShadow: `0 8px 24px ${withAlpha(colors.canvas, 0.6)}`,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  open: { marginLeft: space.sm },
});
