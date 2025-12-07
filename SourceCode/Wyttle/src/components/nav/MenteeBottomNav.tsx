import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  // Optional – you can also just call usePathname() inside
};

export default function MenteeBottomNav(_: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const tabs = [
    { key: 'connections', label: 'Connections', path: '/(app)/Mentee/connections' },
    { key: 'discovery', label: 'Discover', path: '/(app)/Mentee/discovery' },
    { key: 'mentorHub', label: 'Mentor Hub', path: '/(app)/Mentee/mentor-hub' },
    { key: 'settings', label: 'Settings', path: '/(app)/Mentee/settings' },
  ];

  const active =
    tabs.find((t) => pathname.startsWith(t.path))?.key ?? 'connections';

  const activeTab = tabs.find((t) => t.key === active);

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
      {/* main bar */}
      <View style={styles.bar}>
        {/* left two */}
        <NavItem
          label="Connections"
          active={active === 'connections'}
          onPress={() => goTo('/(app)/Mentee/connections')}
        />
        <NavItem
          label="Discover"
          active={active === 'discovery'}
          onPress={() => goTo('/(app)/Mentee/discovery')}
        />

        {/* gap for diamond */}
        <View style={{ width: 70 }} />

        {/* right two */}
        <NavItem
          label="Mentor Hub"
          active={active === 'mentorHub'}
          onPress={() => goTo('/(app)/Mentee/mentor-hub')}
        />
        <NavItem
          label="Settings"
          active={active === 'settings'}
          onPress={() => goTo('/(app)/Mentee/settings')}
        />
      </View>

      {/* floating middle diamond showing current section */}
      <View style={styles.diamondWrapper}>
        <View style={styles.diamondOuter}>
          <View style={styles.diamondInner}>
            <Text style={styles.diamondText}>
              {activeTab?.label ?? ''}
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
    backgroundColor: '#1F2940', // dark blue
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
    backgroundColor: '#F5E1A4', // accent
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
