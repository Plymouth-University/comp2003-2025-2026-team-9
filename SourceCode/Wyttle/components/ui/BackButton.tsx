import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useNavigationHistory } from '../../src/lib/navigation-history';

export type BackButtonProps = {
  style?: StyleProp<ViewStyle>;
  /** Optional override for back behaviour on specific screens. */
  onPressOverride?: () => void;
};

/**
 * Reusable back button to use when the default header is hidden.
 * Implements "smart" back behaviour inside the app so that once a
 * session is active, users are taken back to their previous in-app
 * screen instead of bouncing to the login/index screen.
 */
export function BackButton({ style, onPressOverride }: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { goBackSmart } = useNavigationHistory();
  const tint = '#fff';

  const handlePress = () => {
    if (onPressOverride) {
      onPressOverride();
      return;
    }
    // 1) Role-specific signup flows → go back to role chooser
    if (
      pathname.startsWith('/(auth)/sign-up-mentee') ||
      pathname.startsWith('/(auth)/sign-up-mentor')
    ) {
      router.replace('/(auth)/sign-up');
      return;
    }

    // 2) On the sign-in or sign-up chooser screens, always go back to the
    // main login chooser regardless of navigation history. This ensures
    // tapping back from "Log in as mentor/mentee" or the register chooser
    // returns to the root role-agnostic login.
    if (
      pathname.startsWith('/(auth)/sign-in') ||
      pathname.startsWith('/(auth)/sign-up')
    ) {
      router.replace('/');
      return;
    }

    // 3) First try to walk back through non-auth history.
    const didGoBack = goBackSmart();
    if (didGoBack) {
      return;
    }

    // 4) If still on an auth screen (typical pre-login case), go to landing.
    if (pathname.startsWith('/(auth)/')) {
      router.replace('/');
      return;
    }

    // 5) Fallback: go to app landing
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
