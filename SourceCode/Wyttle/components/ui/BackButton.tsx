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
    // 1) Role-specific signup flows → go back to role chooser
    if (
      pathname.startsWith('/(auth)/sign-up-mentee') ||
      pathname.startsWith('/(auth)/sign-up-mentor')
    ) {
      router.replace('/(auth)/sign-up');
      return;
    }

    // 2) Any other auth screen → go back to app landing (index)
    if (pathname.startsWith('/(auth)/')) {
      router.replace('/');
      return;
    }

    // 3) In the main app, always go home instead of leaving the app/history
    if (pathname.startsWith('/(app)/')) {
      router.replace('/(app)/home');
      return;
    }

    // 4) Fallback: stay inside the app root
    router.replace('/');
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
