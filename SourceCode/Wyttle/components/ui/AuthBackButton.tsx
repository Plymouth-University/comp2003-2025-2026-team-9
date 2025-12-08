import { useRouter } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';

export type AuthBackButtonProps = {
  style?: StyleProp<ViewStyle>;
};

/**
 * Simple back button for pre-auth screens.
 * Just goes back one step in the navigation stack using router.back().
 */
export function AuthBackButton({ style }: AuthBackButtonProps) {
  const router = useRouter();
  const tint = '#fff';

  const handlePress = () => {
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
