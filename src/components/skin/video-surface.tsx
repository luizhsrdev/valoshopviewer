import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors } from '@/theme';

/**
 * Superfície de vídeo: um <video> sem controles dentro da WebView (que já
 * está no build). Toda a interface é desenhada em React Native; aqui só
 * trocamos comandos e estado por mensagens.
 */

export type VideoState = {
  time: number;
  duration: number;
  buffered: number;
  paused: boolean;
  muted: boolean;
  waiting: boolean;
  ended: boolean;
  error: boolean;
};

export type VideoSurfaceHandle = {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setMuted(muted: boolean): void;
};

type Props = {
  uri: string;
  startAt?: number;
  autoPlay?: boolean;
  muted?: boolean;
  onState(state: VideoState): void;
};

export const VideoSurface = forwardRef<VideoSurfaceHandle, Props>(function VideoSurface(
  { uri, startAt = 0, autoPlay = true, muted = false, onState },
  ref,
) {
  // WebView<{}>: o padrão da lib (P = undefined) torna as props `never` com ref.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  const web = useRef<WebView<{}>>(null);

  useImperativeHandle(ref, () => {
    const send = (cmd: object) => web.current?.injectJavaScript(`window.__cmd(${JSON.stringify(cmd)});true;`);
    return {
      play: () => send({ type: 'play' }),
      pause: () => send({ type: 'pause' }),
      seek: (t) => send({ type: 'seek', t }),
      setMuted: (m) => send({ type: 'muted', m }),
    };
  });

  // O HTML só muda com o vídeo; posição e som iniciais entram uma vez.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildHtml(uri, startAt, autoPlay, muted), [uri]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      onState(JSON.parse(e.nativeEvent.data) as VideoState);
    } catch {}
  };

  return (
    <WebView
      ref={web}
      source={{ html, baseUrl: 'https://media.valorant-api.com/' }}
      onMessage={onMessage}
      // Só o nosso HTML: nada de navegar para outras páginas.
      onShouldStartLoadWithRequest={(r) => r.url.startsWith('about:') || r.url.startsWith('https://media.valorant-api.com/')}
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      javaScriptEnabled
      scrollEnabled={false}
      overScrollMode="never"
      setBuiltInZoomControls={false}
      style={styles.web}
      containerStyle={styles.web}
    />
  );
});

function buildHtml(uri: string, startAt: number, autoPlay: boolean, muted: boolean) {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body{margin:0;height:100%;background:${colors.canvas};overflow:hidden;-webkit-tap-highlight-color:transparent}
video{position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:${colors.canvas};pointer-events:none}
</style></head><body>
<video id="v" src="${encodeURI(uri)}" playsinline loop preload="auto" ${muted ? 'muted' : ''}></video>
<script>
(function(){
  var v=document.getElementById('v'), last=0, error=false, waiting=true;
  function buffered(){ try{ for(var i=v.buffered.length-1;i>=0;i--){ if(v.buffered.start(i)<=v.currentTime+0.1) return v.buffered.end(i);} }catch(e){} return 0; }
  function post(force){
    var now=Date.now(); if(!force && now-last<200) return; last=now;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      time:v.currentTime||0, duration:isFinite(v.duration)?v.duration:0, buffered:buffered(),
      paused:v.paused, muted:v.muted, waiting:waiting, ended:v.ended, error:error
    }));
  }
  v.addEventListener('timeupdate',function(){post(false)});
  v.addEventListener('progress',function(){post(false)});
  ['play','pause','volumechange','seeked','ended','loadedmetadata','durationchange'].forEach(function(n){v.addEventListener(n,function(){post(true)})});
  v.addEventListener('waiting',function(){waiting=true;post(true)});
  v.addEventListener('playing',function(){waiting=false;post(true)});
  v.addEventListener('canplay',function(){waiting=false;post(true)});
  v.addEventListener('error',function(){error=true;waiting=false;post(true)});
  v.addEventListener('loadedmetadata',function(){ if(${startAt}>0) v.currentTime=${startAt}; },{once:true});
  window.__cmd=function(c){
    if(c.type==='play'){ error=false; v.play().catch(function(){ v.muted=true; v.play().catch(function(){}); }); }
    else if(c.type==='pause') v.pause();
    else if(c.type==='seek' && isFinite(v.duration)) v.currentTime=Math.max(0,Math.min(v.duration,c.t));
    else if(c.type==='muted') v.muted=c.m;
    post(true);
  };
  if(${autoPlay}) window.__cmd({type:'play'});
})();
</script></body></html>`;
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: colors.canvas },
});
