import { useRouter, usePathname } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const tint = '#fff';

  const handlePress = () => {
    // Custom behaviour for auth stack so back is predictable on web & native
    if (pathname.startsWith('/(auth)/sign-up-mentee') || pathname.startsWith('/(auth)/sign-up-mentor')) {
      router.replace('/(auth)/sign-up');
      return;
    }

    if (pathname.startsWith('/(auth)/sign-up') || pathname.startsWith('/(auth)/sign-in')) {
      router.replace('/');
      return;
    }

    // Fallback: normal back navigation
    router.back();
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
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
