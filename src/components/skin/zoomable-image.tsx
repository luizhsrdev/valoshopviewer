import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme';

const MAX = 4;
const DOUBLE_TAP = 2.5;

/**
 * Imagem com zoom: pinça para ampliar, arraste para mover e toque duplo para
 * alternar entre 1x e 2,5x. Volta ao normal quando a imagem muda.
 */
export function ZoomableImage({ uri }: { uri: string | null }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  const settle = (v: number) => {
    'worklet';
    return reduced ? v : withSpring(v, motion.spring);
  };

  // Limita o arraste para a imagem não sair da área visível.
  const clamp = (value: number, size: number, s: number) => {
    'worklet';
    const limit = (size * (s - 1)) / 2;
    return Math.min(limit, Math.max(-limit, value));
  };

  useEffect(() => {
    scale.set(1);
    x.set(0);
    y.set(0);
  }, [uri, scale, x, y]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.set(scale.get());
    })
    .onUpdate((e) => {
      scale.set(Math.min(MAX, Math.max(1, startScale.get() * e.scale)));
    })
    .onEnd(() => {
      if (scale.get() < 1.05) {
        scale.set(settle(1));
        x.set(settle(0));
        y.set(settle(0));
      } else {
        x.set(settle(clamp(x.get(), width.get(), scale.get())));
        y.set(settle(clamp(y.get(), height.get(), scale.get())));
      }
    });

  // Só arrasta com zoom; sem zoom, o gesto falha e a tela rola normalmente.
  const pan = Gesture.Pan()
    .manualActivation(true)
    .averageTouches(true)
    .onTouchesMove((_e, state) => {
      if (scale.get() > 1.05) state.activate();
      else state.fail();
    })
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
    })
    .onUpdate((e) => {
      x.set(clamp(startX.get() + e.translationX, width.get(), scale.get()));
      y.set(clamp(startY.get() + e.translationY, height.get(), scale.get()));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomIn = scale.get() < 1.5;
      scale.set(reduced ? (zoomIn ? DOUBLE_TAP : 1) : withTiming(zoomIn ? DOUBLE_TAP : 1, { duration: motion.base }));
      x.set(settle(0));
      y.set(settle(0));
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.box}
        collapsable={false}
        onLayout={(e) => {
          width.set(e.nativeEvent.layout.width);
          height.set(e.nativeEvent.layout.height);
        }}>
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
          <Image source={uri ?? undefined} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} cachePolicy="memory-disk" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, overflow: 'hidden' },
});
