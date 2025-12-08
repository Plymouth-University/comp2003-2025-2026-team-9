import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useNavigationHistory } from '../../src/lib/navigation-history';

export type BackButtonProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Reusable back button to use when the default header is hidden.
 * Implements "smart" back behaviour inside the app so that once a
 * session is active, users are taken back to their previous in-app
 * screen instead of bouncing to the login/index screen.
 */
export function BackButton({ style }: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { goBackSmart } = useNavigationHistory();
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

    // 2) First try to walk back through non-auth history.
    const didGoBack = goBackSmart();
    if (didGoBack) {
      return;
    }

    // 3) If still on an auth screen (typical pre-login case), go to landing.
    if (pathname.startsWith('/(auth)/')) {
      router.replace('/');
      return;
    }

    // 4) Fallback: go to app landing
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
