// A tarefa em segundo plano precisa ser definida no escopo global.
import '@/lib/background';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import * as Notifications from 'expo-notifications';
import { DarkTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionProvider, useSession } from '@/providers/session';
import { ShopProvider } from '@/providers/shop';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync(colors.canvas);

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.canvas, card: colors.canvas, primary: colors.accent },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ThemeProvider value={navTheme}>
        <SessionProvider>
          <ShopProvider>
            <StatusBar style="light" />
            <Routes ready={fontsLoaded} />
          </ShopProvider>
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Routes({ ready }: { ready: boolean }) {
  const { status } = useSession();
  const booted = ready && status !== 'loading';

  useEffect(() => {
    if (booted) SplashScreen.hideAsync();
  }, [booted]);

  useNotificationRedirect(status === 'signedIn');

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="mercado" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="pacote/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="skin/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'consent'}>
        <Stack.Screen name="boas-vindas" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

/** Ao tocar na notificação do mercado, abre direto a tela dele. */
function useNotificationRedirect(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const go = (n: Notifications.Notification) => {
      const url = n.request.content.data?.url;
      if (typeof url === 'string') router.push(url as '/mercado');
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) {
      go(last.notification);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      go(r.notification);
      Notifications.clearLastNotificationResponse();
    });
    return () => sub.remove();
  }, [enabled]);
}
