import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { CONSENT_POINTS, FAN_NOTICE_EN, FAN_NOTICE_PT } from '@/lib/consent';
import { useSession } from '@/providers/session';
import { colors, radius, space } from '@/theme';

export default function Welcome() {
  const { accept } = useSession();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text variant="micro" color={colors.mute}>
            ANTES DE COMEÇAR
          </Text>
          <Text variant="display" color={colors.ink}>
            Minha Loja
          </Text>
          <Text color={colors.mute}>
            Veja a loja do Valorant sem abrir o jogo. Leia com atenção antes de continuar.
          </Text>
        </View>

        <View style={styles.list}>
          {CONSENT_POINTS.map((p) => (
            <View key={p} style={styles.point}>
              <View style={styles.bullet} />
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <Text variant="caption" color={colors.mute}>
            {FAN_NOTICE_PT}
          </Text>
          <View style={styles.rule} />
          <Text variant="caption" color={colors.ash}>
            {FAN_NOTICE_EN}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => setChecked((c) => !c)}
          style={styles.check}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}>
          <View style={[styles.box, checked && styles.boxOn]}>
            {checked ? <Text variant="micro" color={colors.onAccent}>✓</Text> : null}
          </View>
          <Text variant="label" color={colors.body} style={{ flex: 1 }}>
            Li, entendi os riscos e quero continuar.
          </Text>
        </Pressable>
        <Button
          kind="accent"
          label="Aceitar e continuar"
          disabled={!checked}
          busy={busy}
          onPress={async () => {
            setBusy(true);
            await accept();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.lg, paddingTop: space.section, gap: space.xl },
  header: { gap: space.sm },
  list: { gap: space.md },
  point: { flexDirection: 'row', gap: space.md },
  bullet: { width: 6, height: 1, backgroundColor: colors.ash, marginTop: 12 },
  pointText: { flex: 1 },
  notice: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  rule: { height: 1, backgroundColor: colors.hairline },
  footer: {
    padding: space.lg,
    gap: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.canvas,
  },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
