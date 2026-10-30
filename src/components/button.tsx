import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colors, radius, space } from '@/theme';

import { Text } from './text';

type Kind = 'primary' | 'accent' | 'ghost';

const palette: Record<Kind, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary },
  accent: { bg: colors.accent, pressed: colors.accentPressed, fg: colors.onAccent },
  ghost: { bg: 'transparent', pressed: colors.surfacePressed, fg: colors.ink, border: colors.hairlineStrong },
};

export function Button({
  label,
  kind = 'primary',
  busy = false,
  disabled,
  style,
  ...props
}: PressableProps & { label: string; kind?: Kind; busy?: boolean }) {
  const p = palette[kind];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy }}
      disabled={off}
      style={(state) => [
        styles.base,
        {
          backgroundColor: off ? colors.surfaceElevated : state.pressed ? p.pressed : p.bg,
          borderColor: p.border ?? 'transparent',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      {busy ? (
        <ActivityIndicator color={colors.mute} />
      ) : (
        <Text variant="label" color={off ? colors.ash : p.fg}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48, // alvo de toque confortável no celular
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
