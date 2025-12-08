import { router, usePathname, type Href } from 'expo-router';
import React, { JSX } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '../../../components/Logo';
import { GraduationIcon, SettingIcon, StackIcon, UsersAltIcon } from './MenteeNavIcons';
import { NavBlankShape } from './NavBlankShape';

const VIEWBOX_WIDTH = 200.27968;
const VIEWBOX_HEIGHT = 53.78904;
const VIEWBOX_CIRCLE_CENTER_Y = 18.258205; // 15.83455 + 2.423655 from SVG
const NAV_SCALE = 1.3;
const BASE_NAV_WIDTH = 390; // keep nav height based on phone-ish width
type Props = {
  // Optional – you can also just call usePathname() inside
};

export default function MenteeBottomNav(_: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const [navWidth, setNavWidth] = React.useState(() => Dimensions.get('window').width);

  const bottomInset = insets.bottom > 0 ? insets.bottom : 10;
  const bottomFillHeight = bottomInset ;

  // Compute vertical offset so the active circle aligns with the SVG bump center.
  // Use the same clamped vertical scale as NavBlankShape so the circle stays
  // aligned even on very wide screens.
  const width = navWidth;
  const widthScale = (width / VIEWBOX_WIDTH) * NAV_SCALE;
  const designScale = (BASE_NAV_WIDTH / VIEWBOX_WIDTH) * NAV_SCALE;
  const scale = Math.min(widthScale, designScale);
  const circleCenterOffset = (VIEWBOX_HEIGHT - VIEWBOX_CIRCLE_CENTER_Y) * scale - 45;

  const tabs = [
    { key: 'connections', label: 'Connections', path: '/(app)/Mentee/connections', Icon: UsersAltIcon },
    { key: 'discovery', label: 'Discover', path: '/(app)/Mentee/discovery', Icon: StackIcon },
    { key: 'mentorHub', label: 'Mentor Hub', path: '/(app)/Mentee/mentor-hub', Icon: GraduationIcon },
    { key: 'settings', label: 'Settings', path: '/(app)/Mentee/settings', Icon: SettingIcon },
  ] as const;

  // Derive active tab from the last pathname segment so it works reliably
  // regardless of group segments like "(app)".
  const [pathWithoutQuery] = pathname.split('?');
  const segments = pathWithoutQuery.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? 'connections';

  let activeKey: (typeof tabs)[number]['key'] = 'connections';
  switch (lastSegment) {
    case 'connections':
      activeKey = 'connections';
      break;
    case 'discovery':
      activeKey = 'discovery';
      break;
    case 'mentor-hub':
      activeKey = 'mentorHub';
      break;
    case 'settings':
      activeKey = 'settings';
      break;
    default:
      activeKey = 'connections';
  }

  const active = activeKey;

  const goTo = (path: string, key: (typeof tabs)[number]['key']) => {
    // If this tab is already active, do nothing to avoid re-running
    // the navigation animation or resetting the stack.
    if (key === active) return;
    router.replace(path as Href);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: bottomFillHeight },
      ]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== navWidth) {
          setNavWidth(w);
        }
      }}
    >
      {/* solid fill at the very bottom to avoid any white strip */}
      <View
        style={[
          styles.bottomFill,
          { height: bottomFillHeight },
        ]}
      />

      {/* SVG background shape */}
      <NavBlankShape style={styles.background} width={navWidth} />

      {/* main bar content (tabs) */}
      <View style={styles.bar}>
        {/* left group */}
        <View style={styles.sideGroup}>
          <NavItem
            Icon={UsersAltIcon}
            active={active === 'connections'}
            onPress={() => goTo('/(app)/Mentee/connections', 'connections')}
          />
          <NavItem
            Icon={StackIcon}
            active={active === 'discovery'}
            onPress={() => goTo('/(app)/Mentee/discovery', 'discovery')}
          />
        </View>

        {/* gap for diamond */}
        <View style={{ width: 80 }} />

        {/* right group */}
        <View style={styles.sideGroup}>
          <NavItem
            Icon={GraduationIcon}
            active={active === 'mentorHub'}
            onPress={() => goTo('/(app)/Mentee/mentor-hub', 'mentorHub')}
          />
          <NavItem
            Icon={SettingIcon}
            active={active === 'settings'}
            onPress={() => goTo('/(app)/Mentee/settings', 'settings')}
          />
        </View>
      </View>

      {/* floating middle logo circle */}
      <View style={[styles.diamondWrapper, { bottom: circleCenterOffset }]}>
        <View style={styles.diamondOuter}>
          <View style={styles.diamondInner}>
            <Logo size={54} fill="#968c6c" />
          </View>
        </View>
      </View>
    </View>
  );
}

type NavItemIconComponent = (props: { color: string; size?: number }) => JSX.Element;

type NavItemProps = {
  Icon: NavItemIconComponent;
  active: boolean;
  onPress: () => void;
};

function NavItem({ Icon, active, onPress }: NavItemProps) {
  const color = active ? '#968c6c' : '#dedfe0';

  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Icon color={color} size={30} />
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
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#333f5c',
  },
  bar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 0,
    alignItems: 'center',
  },
  sideGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 26,
  },
  navItem: {
    alignItems: 'center',
  },
  diamondWrapper: {
    position: 'absolute',
    // `bottom` is set inline using `circleCenterOffset` so the circle
    // tracks the SVG bump center across device sizes.
    alignItems: 'center',
  },
  diamondOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  diamondInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
  },
});
