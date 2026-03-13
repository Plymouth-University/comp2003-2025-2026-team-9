import { Slot, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isAdminRoute = pathname.includes('/admin') || pathname.includes('(admin)');
  const shouldOverlayTopSafeArea =
    pathname.includes('profile-view') ||
    isAdminRoute;
  const appShellBackground = isAdminRoute
    ? colorScheme === 'dark'
      ? '#1b2236'
      : '#f4efe4'
    : theme.background;

  return (
    <View style={[styles.container, { backgroundColor: appShellBackground }]}>
      <View
        style={[
          styles.content,
          {
            paddingTop: shouldOverlayTopSafeArea ? 0 : insets.top,
          },
        ]}
      >
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
