import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useEffect, useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  SlideInDown,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import type { OrderedWeapon } from '@/lib/weapon-order';
import { colors, motion, radius, space, withAlpha } from '@/theme';

import { Text } from './text';

const ROW = 52;

/** Arrastando: elástico leve (é o detalhe bonito da reordenação). */
const DRAG_SPRING = { damping: 20, stiffness: 240, mass: 0.8 };
/**
 * Esconder, mostrar e restaurar: elástico mais leve. Num spring, o quanto a
 * linha passa do lugar é proporcional à distância, então só deixamos passar
 * (~2 px) em movimentos de uma posição; em saltos maiores, sem passar do
 * lugar, para nunca cobrir a linha de cima.
 */
const SHIFT_SPRING = { damping: 21, stiffness: 220, mass: 1 };
const MELEE_LABEL = 'Corpo a corpo';
const label = (w: OrderedWeapon) => (w.category === 'Melee' ? MELEE_LABEL : w.name);

const CATEGORY: Record<string, string> = {
  Sidearm: 'Pistola',
  SMG: 'Submetralhadora',
  Shotgun: 'Escopeta',
  Rifle: 'Fuzil',
  Sniper: 'Sniper',
  Heavy: 'Metralhadora',
  Melee: 'Faca',
};

type Props = {
  visible: boolean;
  shown: OrderedWeapon[];
  hidden: OrderedWeapon[];
  onClose(): void;
  /** Nova ordem das armas visíveis (UUIDs). */
  onReorder(ids: string[]): void;
  onHide(id: string): void;
  onShow(id: string): void;
  onReset(): void;
};

/** Painel "Organizar armas": arrastar para reordenar e esconder do filtro. */
export function WeaponSorter({ visible, shown, hidden, onClose, onReorder, onHide, onShow, onReset }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // Arrastar para fechar: o painel acompanha o dedo (só para baixo) e fecha se
  // passar de ~1/4 da altura ou com um puxão rápido; senão, volta com mola.
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(600);
  const dragToClose = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(6)
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          dragY.set(Math.max(0, e.translationY));
        })
        .onEnd((e) => {
          const far = dragY.get() > sheetHeight.get() * 0.25;
          const fast = e.velocityY > 900;
          if (far || fast) {
            dragY.set(withTiming(sheetHeight.get(), { duration: 180 }, (done) => {
              if (done) scheduleOnRN(onClose);
            }));
          } else {
            dragY.set(withSpring(0, { damping: 22, stiffness: 260 }));
          }
        }),
    [dragY, sheetHeight, onClose],
  );
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.get() }] }));
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" />
        <Animated.View
          entering={reduced ? undefined : SlideInDown.duration(motion.slow)}
          onLayout={(e) => sheetHeight.set(e.nativeEvent.layout.height)}
          style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }, dragStyle]}>
          {/* Arrastar a barrinha ou o cabeçalho para baixo fecha o painel. */}
          <GestureDetector gesture={dragToClose}>
            <View collapsable={false}>
              <View
                style={styles.grabberArea}
                accessibilityRole="adjustable"
                accessibilityLabel="Arraste para baixo para fechar">
                <View style={styles.grabber} />
              </View>
              <View style={styles.head}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="heading" color={colors.ink}>
                    Organizar armas
                  </Text>
                  <Text variant="caption" color={colors.mute}>
                    Arraste pela alça para mudar a ordem. Toque no olho para esconder do filtro.
                  </Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={styles.done} accessibilityRole="button">
                  <Text variant="label" color={colors.onPrimary}>
                    Concluir
                  </Text>
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text variant="micro" color={colors.ash}>
              NO FILTRO · {shown.length}
            </Text>
            <SortableList items={shown} onReorder={onReorder} onHide={onHide} reduced={reduced} />

            {hidden.length ? (
              <>
                <Text variant="micro" color={colors.ash} style={styles.hiddenTitle}>
                  OCULTAS · {hidden.length}
                </Text>
                <View style={styles.box}>
                  {hidden.map((w, i) => (
                    <View key={w.uuid} style={[styles.row, styles.static, i > 0 && styles.divider]}>
                      <View style={styles.handle} />
                      <View style={styles.rowText}>
                        <Text variant="label" color={colors.ash}>
                          {label(w)}
                        </Text>
                      </View>
                      <EyeButton on={false} name={label(w)} onPress={() => onShow(w.uuid)} />
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <Pressable onPress={onReset} hitSlop={8} style={styles.reset} accessibilityRole="button">
              <Ionicons name="refresh" size={14} color={colors.mute} />
              <Text variant="label" color={colors.mute}>
                Restaurar padrão
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function EyeButton({ on, name, onPress }: { on: boolean; name: string; onPress(): void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.eye, pressed && { backgroundColor: colors.surfacePressed }]}
      accessibilityRole="button"
      accessibilityLabel={on ? `Esconder ${name} do filtro` : `Mostrar ${name} no filtro`}>
      <Ionicons name={on ? 'eye-outline' : 'eye-off-outline'} size={18} color={on ? colors.body : colors.ash} />
    </Pressable>
  );
}

/**
 * Lista reordenável: as linhas ficam em posição absoluta e se movem na thread
 * de UI. `positions` (UUID → índice) é a fonte da verdade durante o arraste;
 * ao soltar, a nova ordem vai para o React e é salva.
 */
function SortableList({
  items,
  onReorder,
  onHide,
  reduced,
}: {
  items: OrderedWeapon[];
  onReorder(ids: string[]): void;
  onHide(id: string): void;
  reduced: boolean;
}) {
  const initial = useMemo(() => Object.fromEntries(items.map((w, i) => [w.uuid, i])), [items]);
  const positions = useSharedValue<Record<string, number>>(initial);
  // Alguma linha está sendo arrastada? Decide entre elástico e deslize simples.
  const dragging = useSharedValue(false);

  useEffect(() => {
    positions.set(initial);
  }, [initial, positions]);

  const commit = (map: Record<string, number>) => {
    onReorder(Object.keys(map).sort((a, b) => map[a]! - map[b]!));
  };

  return (
    <View style={[styles.box, { height: items.length * ROW }]}>
      {items.map((w) => (
        <SortableRow
          key={w.uuid}
          item={w}
          count={items.length}
          positions={positions}
          dragging={dragging}
          onCommit={commit}
          onHide={onHide}
          reduced={reduced}
        />
      ))}
    </View>
  );
}

const SortableRow = memo(function SortableRow({
  item,
  count,
  positions,
  dragging,
  onCommit,
  onHide,
  reduced,
}: {
  item: OrderedWeapon;
  count: number;
  positions: SharedValue<Record<string, number>>;
  dragging: SharedValue<boolean>;
  onCommit(map: Record<string, number>): void;
  onHide(id: string): void;
  reduced: boolean;
}) {
  const id = item.uuid;
  const y = useSharedValue((positions.get()[id] ?? 0) * ROW);
  const startY = useSharedValue(0);
  const active = useSharedValue(false);

  // As outras linhas vão para a nova posição: com elástico leve durante o
  // arraste; com deslize simples ao esconder, mostrar ou restaurar.
  useAnimatedReaction(
    () => positions.get()[id] ?? 0,
    (pos, prev) => {
      if (pos === prev || active.get()) return;
      const to = pos * ROW;
      if (reduced) y.set(to);
      else if (dragging.get()) y.set(withSpring(to, DRAG_SPRING));
      else y.set(withSpring(to, { ...SHIFT_SPRING, overshootClamping: Math.abs(to - y.get()) > ROW * 1.5 }));
    },
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onStart(() => {
          active.set(true);
          dragging.set(true);
          startY.set(y.get());
        })
        .onUpdate((e) => {
          const next = Math.min((count - 1) * ROW, Math.max(0, startY.get() + e.translationY));
          y.set(next);
          const to = Math.round(next / ROW);
          const map = positions.get();
          const from = map[id] ?? 0;
          if (to !== from) {
            // Desloca as linhas entre a origem e o destino (funciona mesmo pulando várias).
            const updated: Record<string, number> = {};
            for (const key in map) {
              const p = map[key]!;
              if (key === id) updated[key] = to;
              else if (from < to && p > from && p <= to) updated[key] = p - 1;
              else if (from > to && p >= to && p < from) updated[key] = p + 1;
              else updated[key] = p;
            }
            positions.set(updated);
          }
        })
        .onFinalize(() => {
          if (!active.get()) return;
          active.set(false);
          dragging.set(false);
          const slot = (positions.get()[id] ?? 0) * ROW;
          y.set(reduced ? slot : withSpring(slot, DRAG_SPRING));
          scheduleOnRN(onCommit, positions.get());
        }),
    [active, count, dragging, id, onCommit, positions, reduced, startY, y],
  );

  const style = useAnimatedStyle(() => {
    const on = active.get();
    return {
      transform: [{ translateY: y.get() }, { scale: withTiming(on ? 1.02 : 1, { duration: motion.fast }) }],
      zIndex: on ? 10 : 0,
      backgroundColor: on ? colors.surfaceElevated : colors.surface,
      borderColor: on ? colors.hairlineStrong : 'transparent',
    };
  });

  return (
    <Animated.View style={[styles.row, styles.sortable, style]}>
      <GestureDetector gesture={pan}>
        <View style={styles.handle} accessibilityLabel={`Arrastar ${label(item)}`}>
          <Ionicons name="reorder-two" size={20} color={colors.mute} />
        </View>
      </GestureDetector>
      <View style={styles.rowText}>
        <Text variant="label" color={colors.ink}>
          {label(item)}
        </Text>
        <Text variant="caption" color={colors.ash}>
          {CATEGORY[item.category] ?? item.category}
        </Text>
      </View>
      <EyeButton on name={label(item)} onPress={() => onHide(id)} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(colors.canvas, 0.7) },
  sheet: {
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.hairline,
    paddingTop: space.sm,
  },
  grabberArea: { alignItems: 'center', paddingTop: space.xs, paddingBottom: space.sm },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairlineStrong },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, paddingBottom: space.md },
  done: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  scroll: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm },
  box: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: { height: ROW, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.sm },
  sortable: { position: 'absolute', left: 0, right: 0, top: 0, borderWidth: 1, borderRadius: radius.md },
  static: { backgroundColor: colors.surface },
  divider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  handle: { width: 44, height: ROW, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  eye: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  hiddenTitle: { marginTop: space.md },
  reset: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'center', paddingVertical: space.lg },
});
