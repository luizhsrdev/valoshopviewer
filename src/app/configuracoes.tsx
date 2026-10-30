import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { backgroundStatus } from '@/lib/background';
import { cancelDailyReserve, notificationsAllowed, scheduleDailyReserve, setupNotifications } from '@/lib/notifications';
import { DEFAULT_SETTINGS, readSettings, writeSettings, type NotifySettings } from '@/lib/settings';
import { useSession } from '@/providers/session';
import { useShop } from '@/providers/shop';
import { colors, radius, space } from '@/theme';

const OPTIONS: { key: keyof NotifySettings; title: string; description: string }[] = [
  { key: 'daily', title: 'Loja nova', description: 'Quando a loja diária troca, com os nomes das 4 skins.' },
  { key: 'wishlist', title: 'Lista de desejos', description: 'Em destaque, quando uma skin da sua lista aparece na loja ou no mercado.' },
  { key: 'night', title: 'Mercado noturno', description: 'Quando o mercado noturno abre.' },
];

export default function Configuracoes() {
  const { signOut, demo } = useSession();
  const { shop } = useShop();
  const [settings, setSettings] = useState<NotifySettings>(DEFAULT_SETTINGS);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [restricted, setRestricted] = useState(false);

  const refreshStatus = useCallback(() => {
    notificationsAllowed().then(setAllowed);
    backgroundStatus().then((s) => setRestricted(s === 'restricted'));
  }, []);

  useEffect(() => {
    readSettings().then(setSettings);
    refreshStatus();
    // Volta das configurações do Android: atualiza o estado da permissão.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshStatus());
    return () => sub.remove();
  }, [refreshStatus]);

  const update = async (key: keyof NotifySettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await writeSettings(next);
    if (key === 'daily') {
      if (value && shop) await scheduleDailyReserve(shop, true);
      else await cancelDailyReserve();
    }
  };

  const askPermission = async () => {
    const ok = await setupNotifications();
    if (!ok) await Linking.openSettings();
    refreshStatus();
  };

  const confirmSignOut = () =>
    Alert.alert('Sair da conta?', 'Isso apaga a sessão, a loja salva e as cartas reveladas deste celular.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar para a loja">
          <Text variant="label" color={colors.mute}>
            ‹ Loja
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title" color={colors.ink}>
          Configurações
        </Text>

        <View style={styles.section}>
          <Text variant="micro" color={colors.ash}>
            NOTIFICAÇÕES
          </Text>

          {allowed === false ? (
            <View style={styles.alert}>
              <Text variant="label" color={colors.ink}>
                As notificações estão desligadas no Android
              </Text>
              <Button kind="ghost" label="Permitir notificações" onPress={askPermission} />
            </View>
          ) : null}

          <View style={styles.card}>
            {OPTIONS.map((o, i) => (
              <View key={o.key} style={[styles.row, i > 0 && styles.divider]}>
                <View style={styles.rowText}>
                  <Text variant="bodyStrong" color={colors.ink}>
                    {o.title}
                  </Text>
                  <Text variant="caption" color={colors.mute}>
                    {o.description}
                  </Text>
                </View>
                <Switch
                  value={settings[o.key]}
                  onValueChange={(v) => update(o.key, v)}
                  trackColor={{ false: colors.surfacePressed, true: colors.accent }}
                  thumbColor={colors.ink}
                  accessibilityLabel={o.title}
                />
              </View>
            ))}
          </View>

          <Text variant="caption" color={colors.ash}>
            O Android não garante horário exato em segundo plano, então o aviso pode chegar alguns minutos depois da troca.
          </Text>
          {restricted ? (
            <Text variant="caption" color={colors.body}>
              O Android está limitando o app em segundo plano. Para os avisos chegarem, tire o Minha Loja da otimização de
              bateria.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text variant="micro" color={colors.ash}>
            CONTA
          </Text>
          <Button kind="ghost" label={demo?.enabled ? 'Sair do modo demonstração' : 'Sair da conta'} onPress={confirmSignOut} />
          <Text variant="caption" color={colors.ash}>
            Sair apaga do celular o cookie de sessão da Riot e todos os dados salvos. A lista de desejos fica.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { height: 48, justifyContent: 'center', paddingHorizontal: space.lg },
  content: { padding: space.lg, paddingTop: 0, gap: space.xl, paddingBottom: space.section },
  section: { gap: space.md },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  divider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  rowText: { flex: 1, gap: 2 },
  alert: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceElevated,
  },
});
