import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, space, withAlpha } from '@/theme';

import { Text } from './text';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?(): void;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  /** Toque fora ou botão voltar do Android: mesmo comportamento do `Alert.alert` nativo. */
  onRequestClose(): void;
};

/**
 * Substituto do `Alert.alert` nativo (que usa o diálogo cinza do sistema,
 * destoante do resto do app) com a mesma aparência das telas: fundo escuro,
 * cantos arredondados, tipografia Inter.
 */
export function AlertDialog({ visible, title, message, buttons, onRequestClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onRequestClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onRequestClose} accessibilityRole="button" accessibilityLabel="Fechar" />
        <View style={styles.card}>
          <View style={styles.body}>
            <Text variant="heading" color={colors.ink}>
              {title}
            </Text>
            {message ? (
              <Text variant="body" color={colors.mute} style={styles.message}>
                {message}
              </Text>
            ) : null}
          </View>
          <View style={styles.buttons}>
            {buttons.map((b, i) => (
              <Pressable
                key={b.text}
                onPress={() => {
                  onRequestClose();
                  b.onPress?.();
                }}
                style={({ pressed }) => [
                  styles.button,
                  i > 0 && styles.buttonDivider,
                  pressed && { backgroundColor: colors.surfacePressed },
                ]}
                accessibilityRole="button">
                <Text variant="label" color={b.style === 'destructive' ? colors.accent : b.style === 'cancel' ? colors.mute : colors.ink}>
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(colors.canvas, 0.7) },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  body: { padding: space.lg, gap: space.xs },
  message: { marginTop: 2 },
  buttons: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.hairline },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  buttonDivider: { borderLeftWidth: 1, borderLeftColor: colors.hairline },
});
