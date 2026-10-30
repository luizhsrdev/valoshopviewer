import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useWishlist } from '@/providers/wishlist';
import { colors, withAlpha } from '@/theme';

/** Coração da lista de desejos. Preenchido (vermelho) quando a skin está na lista. */
export function WishHeart({
  skinUuid,
  name,
  size = 18,
  style,
}: {
  skinUuid: string | null;
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { has, toggle } = useWishlist();
  if (!skinUuid) return null;
  const on = has(skinUuid);
  return (
    <Pressable
      onPress={() => toggle(skinUuid)}
      hitSlop={10}
      style={({ pressed }) => [styles.button, { width: size + 14, height: size + 14 }, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Tirar ${name} da lista de desejos` : `Adicionar ${name} à lista de desejos`}>
      <Ionicons name={on ? 'heart' : 'heart-outline'} size={size} color={on ? colors.accent : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: withAlpha(colors.canvas, 0.55),
  },
  pressed: { backgroundColor: withAlpha(colors.canvas, 0.85) },
});
