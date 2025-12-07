import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MentorBottomNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const tabs = [
    { key: 'waiting', label: 'Waiting', path: '/(app)/Mentor/waiting-room' },
    { key: 'connections', label: 'Chats', path: '/(app)/Mentor/connections' },
    { key: 'calendar', label: 'Calendar', path: '/(app)/Mentor/calendar' },
    { key: 'settings', label: 'Settings', path: '/(app)/Mentor/settings' },
  ];

  const active =
    tabs.find((t) => pathname.startsWith(t.path))?.key ?? 'waiting';

  const goTo = (path: string) => {
    if (!pathname.startsWith(path)) {
      router.replace(path as Href);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 },
      ]}
    >
      <View className="bar" style={styles.bar}>
        <NavItem
          label="Waiting"
          active={active === 'waiting'}
          onPress={() => goTo('/(app)/Mentor/waiting-room')}
        />
        <NavItem
          label="Chats"
          active={active === 'connections'}
          onPress={() => goTo('/(app)/Mentor/connections')}
        />

        <View style={{ width: 70 }} />

        <NavItem
          label="Calendar"
          active={active === 'calendar'}
          onPress={() => goTo('/(app)/Mentor/calendar')}
        />
        <NavItem
          label="Settings"
          active={active === 'settings'}
          onPress={() => goTo('/(app)/Mentor/settings')}
        />
      </View>

      <View style={styles.diamondWrapper}>
        <View style={styles.diamondOuter}>
          <View style={styles.diamondInner}>
            <Text style={styles.diamondText}>
              {active === 'waiting'
                ? 'Waiting'
                : active === 'connections'
                ? 'Chats'
                : active === 'calendar'
                ? 'Calendar'
                : 'Settings'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

type NavItemProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function NavItem({ label, active, onPress }: NavItemProps) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <View style={[styles.iconDot, active && styles.iconDotActive]} />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1F2940',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  iconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
  iconDotActive: {
    backgroundColor: '#F5E1A4',
  },
  navLabel: {
    fontSize: 10,
    color: '#D0D4E0',
  },
  navLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  diamondWrapper: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
  },
  diamondOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1F2940',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  diamondInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F5E1A4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
