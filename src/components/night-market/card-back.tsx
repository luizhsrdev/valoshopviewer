import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors, radius, space, withAlpha } from '@/theme';

import { Text } from '../text';

/**
 * Verso da carta: desenho próprio. Moldura fina com cantos marcados e dois
 * losangos concêntricos no centro. Como no jogo, o verso já mostra a cor da
 * raridade; a skin só aparece na revelação. Sem nenhuma arte da Riot.
 */
export function CardBack({ color }: { color: string | null }) {
  const tint = color ?? colors.mute;
  const line = withAlpha(tint, 0.55);
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[withAlpha(tint, 0.3), withAlpha(tint, 0.08), colors.canvas]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Linhas diagonais muito sutis, só para dar textura. */}
      <View style={styles.hatch} pointerEvents="none">
        {Array.from({ length: 9 }, (_, i) => (
          <View key={i} style={[styles.hatchLine, { left: `${i * 14 - 20}%` }]} />
        ))}
      </View>

      <View style={[styles.frame, { borderColor: withAlpha(tint, 0.25) }]}>
        <Corner color={line} style={{ top: -1, left: -1 }} />
        <Corner color={line} style={{ top: -1, right: -1, transform: [{ rotate: '90deg' }] }} />
        <Corner color={line} style={{ bottom: -1, right: -1, transform: [{ rotate: '180deg' }] }} />
        <Corner color={line} style={{ bottom: -1, left: -1, transform: [{ rotate: '270deg' }] }} />

        <View style={styles.center}>
          <View style={[styles.diamond, styles.diamondOuter, { borderColor: line }]} />
          <View
            style={[
              styles.diamond,
              styles.diamondInner,
              { borderColor: withAlpha(tint, 0.4), backgroundColor: withAlpha(tint, 0.12) },
            ]}
          />
          <View style={[styles.core, { backgroundColor: tint }]} />
        </View>
      </View>

      <View style={styles.caption}>
        <Text variant="micro" color={colors.mute}>
          TOQUE PARA REVELAR
        </Text>
      </View>
    </View>
  );
}

function Corner({ color, style }: { color: string; style: object }) {
  return (
    <View style={[styles.corner, style]}>
      <View style={[styles.cornerH, { backgroundColor: color }]} />
      <View style={[styles.cornerV, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hatch: { ...StyleSheet.absoluteFill, overflow: 'hidden', opacity: 0.5 },
  hatchLine: {
    position: 'absolute',
    top: '-20%',
    width: 1,
    height: '140%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    transform: [{ rotate: '24deg' }],
  },
  frame: {
    ...StyleSheet.absoluteFill,
    margin: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 12, height: 12 },
  cornerH: { position: 'absolute', top: 0, left: 0, width: 12, height: 1 },
  cornerV: { position: 'absolute', top: 0, left: 0, width: 1, height: 12 },
  center: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  diamond: { position: 'absolute', transform: [{ rotate: '45deg' }], borderWidth: 1 },
  diamondOuter: { width: 44, height: 44, borderRadius: 3 },
  diamondInner: { width: 24, height: 24, borderRadius: 2 },
  core: { width: 4, height: 4, borderRadius: 2 },
  caption: { position: 'absolute', bottom: space.lg, left: 0, right: 0, alignItems: 'center' },
});
