import * as BackgroundTask from 'expo-background-task';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { newDemoState } from '@/lib/demo';
import { clearRevealed } from '@/lib/night-market';
import { notifyNightMarket, setupNotifications } from '@/lib/notifications';
import { keys, remove } from '@/lib/storage';
import { useSession } from '@/providers/session';
import { useShop } from '@/providers/shop';
import { colors, radius, space } from '@/theme';

import { Text } from '../text';

/** Ferramentas de teste. Só é renderizado quando __DEV__ é true. */
export function DevPanel() {
  const { demo, setDemo } = useSession();
  const { shop } = useShop();
  const [msg, setMsg] = useState<string | null>(null);
  const on = !!demo?.enabled;

  const actions: { label: string; run(): Promise<unknown> | void; show?: boolean }[] = [
    {
      label: on ? 'Desligar demo' : 'Ligar demo',
      run: () => setDemo(on ? null : newDemoState(true)),
    },
    {
      label: 'Novo mercado',
      show: on,
      run: async () => {
        await clearRevealed();
        await setDemo(newDemoState(true));
        setMsg('Novo mercado noturno gerado.');
      },
    },
    {
      label: demo?.night ? 'Fechar mercado' : 'Abrir mercado',
      show: on,
      run: async () => {
        if (demo) await setDemo({ ...demo, night: !demo.night });
      },
    },
    {
      label: 'Resetar cartas',
      run: async () => {
        await clearRevealed();
        setMsg('Cartas viradas de novo. Reabra a tela do mercado.');
      },
    },
    {
      label: 'Notificação em 5 s',
      run: async () => {
        if (!(await setupNotifications())) return setMsg('Permissão de notificação negada.');
        await remove(keys.nightNotified);
        await notifyNightMarket(shop?.night?.endsAt ?? Date.now() + 3 * 86_400_000, 5);
        setMsg('Saia do app: a notificação chega em 5 s. Toque nela para abrir o mercado.');
      },
    },
    {
      label: 'Rodar tarefa em 2º plano',
      run: async () => {
        await BackgroundTask.triggerTaskWorkerForTestingAsync();
        setMsg('Tarefa disparada. Veja o resultado no próximo refresh.');
      },
    },
  ];

  return (
    <View style={styles.box}>
      <Text variant="micro" color={colors.ash}>
        FERRAMENTAS DE DESENVOLVIMENTO
      </Text>
      <View style={styles.wrap}>
        {actions
          .filter((a) => a.show !== false)
          .map((a) => (
            <Pressable
              key={a.label}
              onPress={() => a.run()}
              style={({ pressed }) => [styles.chip, pressed && { backgroundColor: colors.surfacePressed }]}>
              <Text variant="caption" color={colors.body}>
                {a.label}
              </Text>
            </Pressable>
          ))}
      </View>
      {msg ? (
        <Text variant="caption" color={colors.mute}>
          {msg}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: space.xl,
    padding: space.md,
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.hairlineStrong,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceElevated,
  },
});
