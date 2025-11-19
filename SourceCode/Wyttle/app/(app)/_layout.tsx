import { Slot, usePathname, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const NAV_ITEMS = [
  { label: 'Home', href: '/(app)/home' },
  { label: 'Discover', href: '/(app)/discovery' },
  { label: 'Mentors', href: '/(app)/mentors' },
  { label: 'Chat', href: '/(app)/chat' },
  { label: 'Profile', href: '/(app)/profile' },
];

export default function AppLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Slot />
      </View>

      <View
        style={[
          styles.navBar,
          {
            paddingBottom: insets.bottom || 12,
            backgroundColor: theme.background,
            borderTopColor: theme.icon,
          },
        ]}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Pressable
              key={item.href}
              onPress={() => router.replace(item.href)}
              style={({ pressed }) => [
                styles.navItem,
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.navLabel,
                  { color: isActive ? theme.tint : theme.icon },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
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
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
