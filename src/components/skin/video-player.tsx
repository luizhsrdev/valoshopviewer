import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion, radius, space, withAlpha } from '@/theme';

import { Text } from '../text';
import { FullscreenIcon, PauseIcon, PlayIcon, SoundIcon } from './player-icons';
import { VideoSurface, type VideoState, type VideoSurfaceHandle } from './video-surface';

const HIDE_AFTER = 2500;
/** Dois toques na metade esquerda/direita: volta/avança este tanto (s). */
const SEEK_STEP = 3;
/** Toques duplos seguidos dentro deste tempo somam (+3, +6, +9…), como no YouTube. */
const SEEK_CHAIN_MS = 1000;

type Resume = { at: number; muted: boolean };

/**
 * Player de vídeo no padrão do app. A tela cheia gira o player em 90° dentro
 * de um modal (o app é travado em retrato e girar a tela exigiria um módulo
 * nativo novo).
 */
export function VideoPlayer({ uri, tint }: { uri: string; tint: string }) {
  const [fullscreen, setFullscreen] = useState<Resume | null>(null);
  const [resume, setResume] = useState<Resume & { n: number }>({ at: 0, muted: false, n: 0 });
  // Última posição da tela cheia, para voltar ao player normal no mesmo ponto.
  const lastFullscreen = useRef<Resume>({ at: 0, muted: false });

  const exitFullscreen = (r: Resume) => {
    setResume((p) => ({ ...r, n: p.n + 1 }));
    setFullscreen(null);
  };

  return (
    <View style={styles.fill}>
      {fullscreen ? (
        <View style={[styles.fill, styles.center]}>
          <Text variant="caption" color={colors.ash}>
            Reproduzindo em tela cheia
          </Text>
        </View>
      ) : (
        <PlayerView
          key={`inline-${resume.n}`}
          uri={uri}
          tint={tint}
          startAt={resume.at}
          muted={resume.muted}
          fullscreen={false}
          onToggleFullscreen={(r) => {
            lastFullscreen.current = r;
            setFullscreen(r);
          }}
        />
      )}

      <Modal
        visible={!!fullscreen}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        supportedOrientations={['portrait']}
        onRequestClose={() => exitFullscreen(lastFullscreen.current)}>
        {fullscreen ? (
          <FullscreenStage>
            <PlayerView
              uri={uri}
              tint={tint}
              startAt={fullscreen.at}
              muted={fullscreen.muted}
              fullscreen
              onReport={(r) => (lastFullscreen.current = r)}
              onToggleFullscreen={exitFullscreen}
            />
          </FullscreenStage>
        ) : null}
      </Modal>
    </View>
  );
}

/** Gira o conteúdo em 90° para ocupar a tela deitada. */
function FullscreenStage({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  return (
    <GestureHandlerRootView style={[styles.fill, styles.stage]}>
      <StatusBar hidden />
      <View style={{ width: height, height: width, transform: [{ rotate: '90deg' }] }}>{children}</View>
    </GestureHandlerRootView>
  );
}

const EMPTY: VideoState = {
  time: 0,
  duration: 0,
  buffered: 0,
  paused: true,
  muted: false,
  waiting: true,
  ended: false,
  error: false,
};

function PlayerView({
  uri,
  tint,
  startAt,
  muted,
  fullscreen,
  onToggleFullscreen,
  onReport,
}: {
  uri: string;
  tint: string;
  startAt: number;
  muted: boolean;
  fullscreen: boolean;
  onToggleFullscreen(resume: Resume): void;
  onReport?(resume: Resume): void;
}) {
  const reduced = useReducedMotion();
  const surface = useRef<VideoSurfaceHandle>(null);
  const [state, setState] = useState<VideoState>({ ...EMPTY, muted, time: startAt });
  const [shown, setShown] = useState(true);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useSharedValue(0);
  const bufferedSv = useSharedValue(0);
  const controls = useSharedValue(1);
  const trackWidth = useSharedValue(0);
  const scrubbing = useSharedValue(false);

  const playing = !state.paused && !state.error;

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);
  // Some sozinho enquanto toca; volta a qualquer toque.
  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => setShown(false), HIDE_AFTER);
  }, [cancelHide]);

  useEffect(() => {
    controls.set(reduced ? (shown ? 1 : 0) : withTiming(shown ? 1 : 0, { duration: motion.base }));
  }, [shown, reduced, controls]);

  useEffect(() => {
    if (playing && shown && scrubTime === null) scheduleHide();
    return cancelHide;
  }, [playing, shown, scrubTime, scheduleHide, cancelHide]);

  const onState = (s: VideoState) => {
    setState(s);
    onReport?.({ at: s.time, muted: s.muted });
    if (scrubbing.get() || !s.duration) return;
    const target = s.time / s.duration;
    // Interpola entre as atualizações (a cada ~200 ms) para a barra andar lisa.
    const smooth = !s.paused && !reduced && target >= progress.get();
    progress.set(smooth ? withTiming(target, { duration: 220, easing: Easing.linear }) : target);
    bufferedSv.set(Math.min(1, s.buffered / s.duration));
    if (s.paused) setShown(true);
  };

  const toggle = () => {
    if (state.error) return surface.current?.play();
    if (playing) surface.current?.pause();
    else surface.current?.play();
    setShown(true);
  };

  const toggleMute = () => {
    surface.current?.setMuted(!state.muted);
    setShown(true);
  };

  // Pedido de seek vindo do gesto (cada pedido é um objeto novo).
  const [seekRequest, setSeekRequest] = useState<{ t: number } | null>(null);
  // Dois toques: alvo acumulado e aviso visual ("+6 s") do lado tocado.
  const [chain, setChain] = useState<{ side: 'back' | 'forward'; seconds: number; target: number; n: number } | null>(
    null,
  );
  // A sequência (+3, +6, +9…) acaba 1 s depois do último toque duplo.
  useEffect(() => {
    if (!chain) return;
    const id = setTimeout(() => setChain(null), SEEK_CHAIN_MS);
    return () => clearTimeout(id);
  }, [chain]);
  const [overlayWidth, setOverlayWidth] = useState(0);
  useEffect(() => {
    if (seekRequest) surface.current?.seek(seekRequest.t);
  }, [seekRequest]);

  const duration = state.duration;
  const scrub = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .hitSlop({ top: 16, bottom: 16 })
        .onBegin((e) => {
          scrubbing.set(true);
          const f = Math.min(1, Math.max(0, e.x / Math.max(1, trackWidth.get())));
          progress.set(f);
          // Mudar scrubTime reinicia o efeito do timer, que cancela o esconder.
          setScrubTime(f * duration);
        })
        .onUpdate((e) => {
          const f = Math.min(1, Math.max(0, e.x / Math.max(1, trackWidth.get())));
          progress.set(f);
          setScrubTime(f * duration);
        })
        .onFinalize(() => {
          const t = progress.get() * duration;
          scrubbing.set(false);
          setScrubTime(null);
          setSeekRequest({ t });
        }),
    [duration, progress, scrubbing, trackWidth],
  );

  const controlsStyle = useAnimatedStyle(() => ({ opacity: controls.get() }));
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  const bufferedStyle = useAnimatedStyle(() => ({ width: `${bufferedSv.get() * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: progress.get() * trackWidth.get() - 7,
    transform: [{ scale: scrubbing.get() ? 1.3 : 1 }],
  }));
  const trackStyle = useAnimatedStyle(() => ({ height: scrubbing.get() ? 5 : 3 }));

  /** Volta/avança 3 s; toques duplos seguidos somam a partir do último alvo. */
  const seekBy = (side: 'back' | 'forward') => {
    if (!state.duration) return;
    const chained = chain && chain.side === side;
    const from = chained ? chain.target : state.time;
    const target = Math.min(state.duration, Math.max(0, from + (side === 'forward' ? SEEK_STEP : -SEEK_STEP)));
    setChain({ side, seconds: chained ? chain.seconds + SEEK_STEP : SEEK_STEP, target, n: (chain?.n ?? 0) + 1 });
    setSeekRequest({ t: target });
  };

  const taps = useMemo(() => {
    const doubleTap = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .maxDelay(300)
      .onEnd((e, success) => {
        if (success) seekBy(e.x < overlayWidth / 2 ? 'back' : 'forward');
      });
    const singleTap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((_e, success) => {
        if (success) setShown((v) => !v);
      });
    // O toque simples espera o duplo falhar (~300 ms), como em players de vídeo.
    return Gesture.Exclusive(doubleTap, singleTap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayWidth, chain, state.time, state.duration]);

  const shownTime = scrubTime ?? state.time;
  const loading = state.waiting && !state.error;

  return (
    <View style={styles.fill}>
      <VideoSurface ref={surface} uri={uri} startAt={startAt} muted={muted} onState={onState} />

      {/* Camada de toque: um toque mostra/esconde os controles; dois toques
          na metade esquerda/direita voltam/avançam 3 s. */}
      <GestureDetector gesture={taps}>
        <View
          style={StyleSheet.absoluteFill}
          collapsable={false}
          onLayout={(e) => setOverlayWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Esconder controles' : 'Mostrar controles'}
          accessibilityHint="Toque duas vezes nas laterais para voltar ou avançar 3 segundos"
          accessibilityActions={[
            { name: 'activate' },
            { name: 'decrement', label: `Voltar ${SEEK_STEP} segundos` },
            { name: 'increment', label: `Avançar ${SEEK_STEP} segundos` },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'activate') setShown((v) => !v);
            if (e.nativeEvent.actionName === 'decrement') seekBy('back');
            if (e.nativeEvent.actionName === 'increment') seekBy('forward');
          }}
        />
      </GestureDetector>
      {chain ? <SeekFlash key={chain.n} side={chain.side} seconds={chain.seconds} reduced={reduced} /> : null}

      {loading ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : null}

      {state.error ? (
        <View style={[StyleSheet.absoluteFill, styles.center, styles.errorBox]}>
          <Text variant="label" color={colors.ink}>
            Não foi possível tocar o vídeo.
          </Text>
          <Pressable onPress={() => surface.current?.play()} hitSlop={10} accessibilityRole="button">
            <Text variant="label" color={tint}>
              Tentar de novo
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Animated.View style={[StyleSheet.absoluteFill, controlsStyle]} pointerEvents={shown ? 'box-none' : 'none'}>
        {!loading && !state.error ? (
          <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="box-none">
            <Pressable
              onPress={toggle}
              style={({ pressed }) => [styles.bigButton, pressed && { backgroundColor: withAlpha(colors.canvas, 0.9) }]}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pausar' : 'Reproduzir'}>
              {playing ? <PauseIcon color={colors.ink} size={22} /> : <PlayIcon color={colors.ink} size={22} />}
            </Pressable>
          </View>
        ) : null}

        <LinearGradient
          colors={['transparent', withAlpha(colors.canvas, 0.85)]}
          style={[styles.bottom, fullscreen && styles.bottomFull]}
          pointerEvents="box-none">
          <Text variant="micro" color={colors.ink} style={styles.time}>
            {formatClock(shownTime)}
          </Text>

          <GestureDetector gesture={scrub}>
            <View
              style={styles.trackHit}
              onLayout={(e) => trackWidth.set(e.nativeEvent.layout.width)}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Posição do vídeo"
              accessibilityValue={{ min: 0, max: Math.round(state.duration), now: Math.round(shownTime) }}>
              <Animated.View style={[styles.track, trackStyle]}>
                <Animated.View style={[styles.fillBar, { backgroundColor: colors.hairlineStrong }, bufferedStyle]} />
                <Animated.View style={[styles.fillBar, { backgroundColor: tint }, progressStyle]} />
              </Animated.View>
              <Animated.View style={[styles.thumb, { backgroundColor: tint }, thumbStyle]} />
            </View>
          </GestureDetector>

          <Text variant="micro" color={colors.mute} style={styles.time}>
            {formatClock(state.duration)}
          </Text>

          <IconButton label={state.muted ? 'Ativar som' : 'Silenciar'} onPress={toggleMute}>
            <SoundIcon color={colors.ink} muted={state.muted} size={18} />
          </IconButton>
          <IconButton
            label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            onPress={() => onToggleFullscreen({ at: state.time, muted: state.muted })}>
            <FullscreenIcon color={colors.ink} exit={fullscreen} size={18} />
          </IconButton>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/**
 * Aviso de "−3 s / +3 s" no lado tocado: um semicírculo claro com setas,
 * que aparece e some sozinho.
 */
function SeekFlash({ side, seconds, reduced }: { side: 'back' | 'forward'; seconds: number; reduced: boolean }) {
  const opacity = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    opacity.set(
      reduced
        ? withDelay(650, withTiming(0, { duration: 0 }))
        : withSequence(withTiming(1, { duration: 120 }), withDelay(450, withTiming(0, { duration: 260 }))),
    );
  }, [opacity, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const back = side === 'back';
  return (
    <Animated.View pointerEvents="none" style={[styles.flash, back ? styles.flashLeft : styles.flashRight, style]}>
      <View style={styles.flashContent}>
        <Ionicons name={back ? 'play-back' : 'play-forward'} size={22} color={colors.ink} />
        <Text variant="label" color={colors.ink}>
          {back ? '−' : '+'}
          {seconds} s
        </Text>
      </View>
    </Animated.View>
  );
}

function IconButton({ label, onPress, children }: { label: string; onPress(): void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: withAlpha(colors.ink, 0.1) }]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {children}
    </Pressable>
  );
}

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  center: { alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  errorBox: { gap: space.sm, backgroundColor: withAlpha(colors.canvas, 0.7) },
  bigButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.canvas, 0.6),
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  bottomFull: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  time: { minWidth: 30, textAlign: 'center', fontVariant: ['tabular-nums'] },
  trackHit: { flex: 1, height: 32, justifyContent: 'center' },
  track: { borderRadius: radius.full, backgroundColor: withAlpha(colors.ink, 0.15), overflow: 'hidden' },
  fillBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.full },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  flash: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '42%',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.ink, 0.12),
  },
  // Semicírculo encostado na borda, como nos players de vídeo.
  flashLeft: { left: 0, borderTopRightRadius: 9999, borderBottomRightRadius: 9999, alignItems: 'center' },
  flashRight: { right: 0, borderTopLeftRadius: 9999, borderBottomLeftRadius: 9999, alignItems: 'center' },
  flashContent: { alignItems: 'center', gap: space.xs },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
