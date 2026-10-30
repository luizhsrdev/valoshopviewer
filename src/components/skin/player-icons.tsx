import { StyleSheet, View } from 'react-native';

/**
 * Ícones do player desenhados com Views (sem fonte de ícones nem SVG, que
 * exigiriam um build nativo novo). Tamanho base de 20 pt.
 */

export function PlayIcon({ color, size = 20 }: { color: string; size?: number }) {
  const h = size * 0.8;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          marginLeft: size * 0.12,
          width: 0,
          height: 0,
          borderTopWidth: h / 2,
          borderBottomWidth: h / 2,
          borderLeftWidth: h * 0.86,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
    </View>
  );
}

export function PauseIcon({ color, size = 20 }: { color: string; size?: number }) {
  const bar = { width: size * 0.22, height: size * 0.76, borderRadius: size * 0.05, backgroundColor: color };
  return (
    <View style={[styles.box, styles.row, { width: size, height: size, gap: size * 0.2 }]}>
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

export function SoundIcon({ color, muted, size = 20 }: { color: string; muted: boolean; size?: number }) {
  const s = size;
  return (
    <View style={[styles.box, { width: s, height: s }]}>
      <View style={[styles.row, { alignItems: 'center', marginLeft: -s * 0.2 }]}>
        <View style={{ width: s * 0.2, height: s * 0.34, backgroundColor: color, borderRadius: 1 }} />
        <View
          style={{
            width: 0,
            height: 0,
            borderTopWidth: s * 0.3,
            borderBottomWidth: s * 0.3,
            borderRightWidth: s * 0.28,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderRightColor: color,
            marginLeft: -s * 0.02,
          }}
        />
      </View>
      {muted ? (
        <View style={[styles.slash, { width: s * 0.5, right: 0, backgroundColor: color, top: s / 2 - 1 }]} />
      ) : (
        <View
          style={{
            position: 'absolute',
            right: s * 0.04,
            width: s * 0.36,
            height: s * 0.5,
            borderRadius: s,
            borderWidth: 2,
            borderColor: color,
            borderLeftColor: 'transparent',
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
          }}
        />
      )}
    </View>
  );
}

/** Quatro cantos; "exit" vira os cantos para dentro. */
export function FullscreenIcon({ color, exit = false, size = 20 }: { color: string; exit?: boolean; size?: number }) {
  const len = size * 0.32;
  const w = 2;
  const corners = [
    { top: 0, left: 0, rot: 0 },
    { top: 0, right: 0, rot: 90 },
    { bottom: 0, right: 0, rot: 180 },
    { bottom: 0, left: 0, rot: 270 },
  ];
  return (
    <View style={{ width: size, height: size, padding: size * 0.1 }}>
      <View style={{ flex: 1 }}>
        {corners.map(({ rot, ...pos }) => (
          <View
            key={rot}
            style={[
              styles.corner,
              pos,
              { width: len, height: len, transform: [{ rotate: `${exit ? rot + 180 : rot}deg` }] },
            ]}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: len, height: w, backgroundColor: color }} />
            <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: len, backgroundColor: color }} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  slash: { position: 'absolute', height: 2, transform: [{ rotate: '45deg' }] },
  corner: { position: 'absolute' },
});
