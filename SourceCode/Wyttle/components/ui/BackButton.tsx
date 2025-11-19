import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type BackButtonProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Reusable back button to use when the default header is hidden.
 *
 * Usage:
 *   <BackButton />
 */
export function BackButton({ style }: BackButtonProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const tint = '#fff';

  const handlePress = () => {
    // Prefer going back in history; otherwise fall back to root.
    // `canGoBack` is available on the router in expo-router.
    // @ts-expect-error - canGoBack may not be typed on older versions
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        {
          opacity: pressed ? 0.7 : 1,
          backgroundColor: '#333f5c',
        },
        style,
      ]}
      hitSlop={8}
    >
      <IconSymbol name="chevron.left" size={18} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 24,
    left: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
