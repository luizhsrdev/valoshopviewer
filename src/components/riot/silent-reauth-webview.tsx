import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { AUTHORIZE_URL } from '@/lib/riot/constants';
import { isRedirectWithTokens, setReauthBridge } from '@/lib/riot/session';
import { colors } from '@/theme';

const TIMEOUT_MS = 15_000;
/** Para onde a Riot manda quando o cookie não vale mais (login de novo). */
const LOGIN_HOST = 'authenticate.riotgames.com';

type Pending = { resolve(url: string): void; reject(reason: string): void; timer: ReturnType<typeof setTimeout> };

/**
 * WebView invisível, sempre montada, só para renovar a sessão.
 *
 * O `fetch` não serve para isso: o token vem no **fragmento** do link
 * (depois do `#`), que por definição nunca é enviado a um servidor — só um
 * motor de navegador (WebView de verdade) consegue ler essa parte antes de
 * visitar o link. É o mesmo truque da tela de login, só que sem aparecer.
 *
 * Ponte com `src/lib/riot/session.ts` (uma função comum, fora da árvore do
 * React) via `setReauthBridge`, chamada no `useEffect` abaixo.
 */
export function SilentReauthWebView() {
  const [uri, setUri] = useState<string | null>(null);
  const pending = useRef<Pending | null>(null);

  const settle = (fn: (p: Pending) => void) => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setUri(null); // libera a WebView (para de carregar, solta memória)
    fn(p);
  };

  useEffect(() => {
    setReauthBridge({
      reauth: () =>
        new Promise<string>((resolve, reject) => {
          // Só uma renovação por vez; getTokens() em session.ts já garante isso,
          // mas não custa ser defensivo aqui também.
          if (pending.current) return reject('ja-em-andamento');
          const timer = setTimeout(() => settle((p) => p.reject('tempo-esgotado')), TIMEOUT_MS);
          pending.current = { resolve, reject, timer };
          setUri(AUTHORIZE_URL);
        }),
    });
    return () => setReauthBridge(null);
  }, []);

  const onShouldStart = (req: { url: string }) => {
    if (isRedirectWithTokens(req.url)) {
      settle((p) => p.resolve(req.url));
      return false;
    }
    return true;
  };

  const onNav = (nav: WebViewNavigation) => {
    if (isRedirectWithTokens(nav.url)) {
      settle((p) => p.resolve(nav.url));
      return;
    }
    // Foi parar na tela de login: o cookie não é mais válido.
    try {
      if (new URL(nav.url).host === LOGIN_HOST) settle((p) => p.reject('cookie-invalido'));
    } catch {}
  };

  if (!uri) return null;

  return (
    <WebView
      source={{ uri }}
      onShouldStartLoadWithRequest={onShouldStart}
      onNavigationStateChange={onNav}
      onError={() => settle((p) => p.reject('erro-de-rede'))}
      thirdPartyCookiesEnabled
      domStorageEnabled
      javaScriptEnabled
      // Invisível e fora do caminho do toque; precisa de um tamanho real
      // (não 0×0) para o motor de navegação carregar de forma confiável.
      style={styles.hidden}
      containerStyle={styles.hidden}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, backgroundColor: colors.canvas },
});
