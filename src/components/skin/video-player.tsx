import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors } from '@/theme';

/**
 * Player do vídeo de demonstração da skin (mp4 da valorant-api.com).
 * Usa a WebView que já existe no build, para não exigir um build nativo novo.
 */
export function VideoPlayer({ uri }: { uri: string }) {
  const html = useMemo(
    () => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:${colors.canvas}}video{width:100%;height:100%;object-fit:contain;background:${colors.canvas}}</style>
</head><body><video src="${encodeURI(uri)}" controls autoplay playsinline loop></video></body></html>`,
    [uri],
  );
  return (
    <View style={styles.box}>
      <WebView
        source={{ html, baseUrl: 'https://media.valorant-api.com/' }}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        javaScriptEnabled={false}
        scrollEnabled={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: colors.canvas },
  web: { flex: 1, backgroundColor: colors.canvas },
});
