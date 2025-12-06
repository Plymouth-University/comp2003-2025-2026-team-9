import { router, Slot, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '../../src/lib/supabase';

const MENTEE_NAV_ITEMS = [
  { label: 'Home', href: '/(app)/mentee-home' },
  { label: 'Discover', href: '/(app)/discovery' },
  { label: 'Mentors', href: '/(app)/mentor-home' },
  { label: 'Chat', href: '/(app)/chat' },
  { label: 'Profile', href: '/(app)/profile' },
] as const;

const MENTOR_NAV_ITEMS = [
  { label: 'Mentor Home', href: '/(app)/mentor-home' },
  { label: 'Discover', href: '/(app)/discovery' },
  { label: 'Chat', href: '/(app)/chat' },
  { label: 'Profile', href: '/(app)/profile' },
] as const;

export default function AppLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [role, setRole] = useState<'mentor' | 'member' | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      setRole((profile?.role as 'mentor' | 'member') ?? 'member');
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const navItems = role === 'mentor' ? MENTOR_NAV_ITEMS : MENTEE_NAV_ITEMS;

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
        {navItems.map((item) => {
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
