import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { newDemoState } from '@/lib/demo';
import { AUTHORIZE_URL } from '@/lib/riot/constants';
import { completeLogin, isRedirectWithTokens } from '@/lib/riot/session';
import { useSession } from '@/providers/session';
import { colors, radius, space, withAlpha } from '@/theme';

export default function Login() {
  const { signedIn, notice, noticeDiag, setDemo } = useSession();
  const [open, setOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const finish = async (url: string) => {
    if (handled.current) return;
    handled.current = true;
    setFinishing(true);
    try {
      const acc = await completeLogin(url);
      await signedIn(acc);
    } catch (e) {
      handled.current = false;
      setFinishing(false);
      setOpen(false);
      setError(e instanceof Error ? e.message : 'Não foi possível entrar. Tente de novo.');
    }
  };

  // Intercepta o redirecionamento com os tokens antes de carregar a página.
  const onShouldStart = (req: { url: string }) => {
    if (isRedirectWithTokens(req.url)) {
      finish(req.url);
      return false;
    }
    return true;
  };
  const onNav = (nav: WebViewNavigation) => {
    if (isRedirectWithTokens(nav.url)) finish(nav.url);
  };

  if (open) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.webHeader}>
          <Text variant="label" color={colors.ink}>
            Login oficial da Riot
          </Text>
          <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button">
            <Text variant="label" color={colors.mute}>
              Cancelar
            </Text>
          </Pressable>
        </View>
        <View style={styles.webBox}>
          <WebView
            source={{ uri: AUTHORIZE_URL }}
            onShouldStartLoadWithRequest={onShouldStart}
            onNavigationStateChange={onNav}
            thirdPartyCookiesEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            startInLoadingState
            renderLoading={() => <Loading />}
            style={{ backgroundColor: colors.canvas }}
          />
          {finishing ? (
            <View style={styles.overlay}>
              <Loading label="Entrando…" />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="display" color={colors.ink}>
            Entre com sua conta Riot
          </Text>
          <Text color={colors.mute}>
            O login abre a página oficial da Riot dentro do app. Sua senha vai direto para a
            Riot; o Minha Loja guarda só o cookie de sessão, protegido no celular, para não pedir
            login toda vez.
          </Text>
        </View>

        {notice || error ? (
          <View style={styles.alert}>
            <Text variant="label" color={colors.ink}>
              {error ? 'Não deu certo' : 'Sessão expirada'}
            </Text>
            <Text variant="caption" color={colors.body}>
              {error ?? notice}
            </Text>
            {/* Diagnóstico temporário (sem token/cookie): ajuda a achar por que
                a renovação silenciosa está falhando. Segure para copiar e me
                mandar. Removo assim que confirmarmos a causa. */}
            {!error && noticeDiag ? (
              <Text variant="caption" color={colors.ash} selectable style={styles.diag}>
                {noticeDiag} · segure para copiar
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            kind="accent"
            label="Entrar com a Riot"
            onPress={() => {
              setError(null);
              setOpen(true);
            }}
          />
          <Text variant="caption" color={colors.ash} style={styles.hint}>
            Use Riot ID e senha. O login com Google costuma ser bloqueado em navegadores embutidos.
          </Text>
          {__DEV__ ? (
            <Button
              kind="ghost"
              label="Entrar no modo demonstração (dev)"
              onPress={() => setDemo(newDemoState(true))}
            />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.mute} />
      {label ? (
        <Text variant="caption" color={colors.mute}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flex: 1, padding: space.lg, paddingTop: space.section, gap: space.xl },
  header: { gap: space.sm },
  alert: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.4),
    backgroundColor: colors.dangerSoft,
  },
  diag: { marginTop: space.xs },
  actions: { marginTop: 'auto', gap: space.md },
  hint: { textAlign: 'center' },
  webHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  webBox: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.canvas,
  },
});
