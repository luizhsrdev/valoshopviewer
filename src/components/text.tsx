import { Text as RNText, type TextProps } from 'react-native';

import { colors, type as typeScale } from '@/theme';

type Variant = keyof typeof typeScale;

export function Text({
  variant = 'body',
  color = colors.body,
  style,
  ...props
}: TextProps & { variant?: Variant; color?: string }) {
  return <RNText {...props} style={[typeScale[variant], { color }, style]} />;
}
