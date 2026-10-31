import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme';

import { Button } from '../button';
import { Text } from '../text';

type Props = {
  onClose(): void;
  title: string;
  /** Título do seletor nativo de apps (Android). */
  dialogTitle: string;
  /** Só libera o botão depois que as imagens do cartão carregarem. */
  ready: boolean;
  /** Largura ÷ altura do cartão. Padrão 9:16 (formato "story"). */
  aspectRatio?: number;
  children: ReactNode;
};

/**
 * Painel de pré-visualização + compartilhamento. Diferente do `FilterSheet`
 * (sempre montado, só alterna `visible`), este é montado só enquanto aberto:
 * cada abertura remonta o cartão do zero, o que já reseta o estado de
 * "imagens carregadas" sem precisar de lógica extra.
 */
export function ShareSheet({ onClose, title, dialogTitle, ready, aspectRatio = 9 / 16, children }: Props) {
  const insets = useSafeAreaInsets();
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    if (!cardRef.current) return;
    setError(null);
    setBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) throw new Error('sem-compartilhamento');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle });
    } catch {
      setError('Não foi possível gerar a imagem. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.head}>
            <Text variant="heading" color={colors.ink}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color={colors.mute} />
            </Pressable>
          </View>

          {/* flexShrink: a prévia encolhe (e aí rola) se não couber, mas o botão
              abaixo nunca sai da tela — era possível ficar sem ver "Compartilhar"
              em telas menores ou com proporção bem vertical (9:16). */}
          <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
            {/* collapsable={false}: no Android, uma View "vazia" de estilo pode ser
                otimizada para fora da árvore nativa, e o view-shot perde a referência. */}
            <View ref={cardRef} collapsable={false} style={[styles.cardShadow, { aspectRatio }]}>
              {children}
            </View>
          </ScrollView>

          {error ? (
            <Text variant="caption" color={colors.body}>
              {error}
            </Text>
          ) : !ready ? (
            <Text variant="caption" color={colors.ash}>
              Carregando imagens…
            </Text>
          ) : null}

          <Button label="Compartilhar" kind="accent" busy={busy} disabled={!ready} onPress={share} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,8,10,0.8)' },
  sheet: {
    maxHeight: '94%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.hairline,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewScroll: { flexShrink: 1 },
  previewContent: { alignItems: 'center', paddingVertical: space.xs },
  cardShadow: {
    width: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
});
