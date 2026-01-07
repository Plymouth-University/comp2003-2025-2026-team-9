import { router, usePathname, type Href } from 'expo-router';
import React, { JSX } from 'react';
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '../../../components/Logo';
import { CalendarIcon, ChatIcon, SettingIcon, VideoIcon } from './MentorNavIcons';
import { NavBlankShape } from './NavBlankShape';

const VIEWBOX_WIDTH = 200.27968;
const VIEWBOX_HEIGHT = 53.78904;
const VIEWBOX_CIRCLE_CENTER_Y = 18.258205;
const NAV_SCALE = 1.3;
const BASE_NAV_WIDTH = 390; // keep nav height based on phone-ish width

export default function MentorBottomNav() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const [navWidth, setNavWidth] = React.useState(() => Dimensions.get('window').width);

  const bottomInset = insets.bottom > 0 ? insets.bottom : 10;
  const bottomFillHeight = bottomInset;

  const width = navWidth;
  const widthScale = (width / VIEWBOX_WIDTH) * NAV_SCALE;
  const designScale = (BASE_NAV_WIDTH / VIEWBOX_WIDTH) * NAV_SCALE;
  const scale = Math.min(widthScale, designScale);
  const svgHeight = VIEWBOX_HEIGHT * scale / 1.42;
  const circleCenterOffset = (VIEWBOX_HEIGHT - VIEWBOX_CIRCLE_CENTER_Y) * scale - 40;
  const contentMaxWidth = Platform.OS === 'web' ? 600 : width;
  const contentWidth = Math.min(width, contentMaxWidth);
  const fillerExtra = Platform.OS === 'web' ? 50 : 0;
  const fillerWidth = Platform.OS === 'web' ? Math.max(0, (width - contentWidth) / 2 + fillerExtra) : 0;

  const tabs = [
    { key: 'waiting', label: 'Waiting', path: '/(app)/Mentor/waiting-room', Icon: VideoIcon },
    { key: 'connections', label: 'Chats', path: '/(app)/Mentor/connections', Icon: ChatIcon },
    { key: 'calendar', label: 'Calendar', path: '/(app)/Mentor/calendar', Icon: CalendarIcon },
    { key: 'settings', label: 'Settings', path: '/(app)/Mentor/settings', Icon: SettingIcon },
  ] as const;

  // Derive active tab from the last pathname segment so it works reliably
  // regardless of group segments like "(app)".
  const [pathWithoutQuery] = pathname.split('?');
  const segments = pathWithoutQuery.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? 'connections';

  let activeKey: (typeof tabs)[number]['key'] = 'connections';
  switch (lastSegment) {
    case 'waiting-room':
      activeKey = 'waiting';
      break;
    case 'connections':
      activeKey = 'connections';
      break;
    case 'calendar':
      activeKey = 'calendar';
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

      {/* Side fills for web to extend to edges */}
      {Platform.OS === 'web' && (
        <>
          <View style={[styles.leftFill, { height: svgHeight, width: fillerWidth }]} />
          <View style={[styles.rightFill, { height: svgHeight, width: fillerWidth }]} />
        </>
      )}

      {/* Centered content wrapper constrained to max SVG-like width */}
      <View style={styles.contentWrapper}>
        {/* main bar content (tabs) */}
        <View style={styles.bar}>
          {/* left group */}
          <View style={styles.sideGroup}>
            <NavItem
              Icon={VideoIcon}
              active={active === 'waiting'}
              onPress={() => goTo('/(app)/Mentor/waiting-room', 'waiting')}
              size={40}
            />
            <NavItem
              Icon={ChatIcon}
              active={active === 'connections'}
              onPress={() => goTo('/(app)/Mentor/connections', 'connections')}
            />
          </View>

          {/* gap for diamond */}
          <View style={{ width: 80 }} />

          {/* right group */}
          <View style={styles.sideGroup}>
            <NavItem
              Icon={CalendarIcon}
              active={active === 'calendar'}
              onPress={() => goTo('/(app)/Mentor/calendar', 'calendar')}
            />
            <NavItem
              Icon={SettingIcon}
              active={active === 'settings'}
              onPress={() => goTo('/(app)/Mentor/settings', 'settings')}
            />
          </View>
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
  size?: number;
};

function NavItem({ Icon, active, onPress, size = 30 }: NavItemProps) {
  const color = active ? '#968c6c' : '#dedfe0';

  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Icon color={color} size={size} />
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
    backgroundColor: 'transparent',
  },
  bottomFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#333f5c',
  },
  leftFill: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '30%',
    backgroundColor: '#333f5c',
  },
  rightFill: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '30%',
    backgroundColor: '#333f5c',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : undefined,
    alignSelf: 'center',
  },
  bar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 0,
    alignItems: 'center',
    marginBottom: Platform.OS === 'android' ? 10 : Platform.OS === 'web' ? 15 : 0,
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
  },
});
