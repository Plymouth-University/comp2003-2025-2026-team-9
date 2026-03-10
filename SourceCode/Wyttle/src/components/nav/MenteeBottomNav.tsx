import { router, usePathname, type Href } from 'expo-router';
import React, { JSX } from 'react';
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GraduationIcon, SettingIcon, StackIcon, UsersAltIcon } from './MenteeNavIcons';
import { NavBlankShape } from './NavBlankShape';

const VIEWBOX_WIDTH = 200.27968;
const VIEWBOX_HEIGHT = 53.78904;
const VIEWBOX_CIRCLE_CENTER_Y = 18.258205; // 15.83455 + 2.423655 from SVG
const NAV_SCALE = 1.3;
const BASE_NAV_WIDTH = 390; // keep nav height based on phone-ish width
type Props = {
  onHeightChange?: (height: number) => void;
};

export default function MenteeBottomNav({ onHeightChange }: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const [navWidth, setNavWidth] = React.useState(() => Dimensions.get('window').width);

  const bottomInset = insets.bottom > 0 ? insets.bottom : 10;
  const bottomFillHeight = bottomInset ;

  // Detect whether Android is using the old bottom navigation buttons
  // vs gesture navigation. When the bottom buttons are present the
  // safe-area inset will be non-zero and typically larger than a
  // small threshold (nav bars are usually ~48dp tall). Use this to
  // tweak the SVG background vertical offset so the nav looks correct.
  const NAV_BUTTONS_THRESHOLD = 20;
  const androidHasNavButtons = Platform.OS === 'android' && insets.bottom >= NAV_BUTTONS_THRESHOLD;
  const backgroundBottom = androidHasNavButtons ? -85 + bottomInset : -85;

  // When Android has the navigation buttons, lift the interactive
  // button row upward slightly so it sits above the system bar and
  // doesn't overlap the visual nav background.
  const buttonLift = androidHasNavButtons ? Math.max(6, Math.min(20, Math.round(bottomInset / 2))) : 0;

  // Compute vertical offset so the active circle aligns with the SVG bump center.
  // Use the same clamped vertical scale as NavBlankShape so the circle stays
  // aligned even on very wide screens.
  const width = navWidth;
  const widthScale = (width / VIEWBOX_WIDTH) * NAV_SCALE;
  const designScale = (BASE_NAV_WIDTH / VIEWBOX_WIDTH) * NAV_SCALE;
  const scale = Math.min(widthScale, designScale);
  const CROPPED_VIEWBOX_HEIGHT = 37.91404;
  const svgHeight = CROPPED_VIEWBOX_HEIGHT * scale;  const circleCenterOffset = (VIEWBOX_HEIGHT - VIEWBOX_CIRCLE_CENTER_Y) * scale - 45;
  const contentMaxWidth = Platform.OS === 'web' ? 600 : width;
  const contentWidth = Math.min(width, contentMaxWidth);
  const fillerExtra = Platform.OS === 'web' ? 50 : 0;
  const fillerWidth = Platform.OS === 'web' ? Math.max(0, (width - contentWidth) / 2 + fillerExtra) : 0;

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
        const { width: w, height } = e.nativeEvent.layout;
        if (w > 0 && w !== navWidth) {
          setNavWidth(w);
        }
        onHeightChange?.(height);
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
      <NavBlankShape style={[styles.background, { bottom: backgroundBottom }]} width={navWidth} showCenter={false} />

      {/* Side fills for web to extend to edges */}
      {Platform.OS === 'web' && (
        <>
          <View style={[styles.leftFill, { height: svgHeight, width: fillerWidth }]} />
          <View style={[styles.rightFill, { height: svgHeight, width: fillerWidth }]} />
        </>
      )}

      {/* Centered content wrapper constrained to max SVG-like width */}
      <View style={[styles.contentWrapper, { transform: [{ translateY: -buttonLift }] }] }>
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
    bottom: -85,
    backgroundColor: 'transparent', // for debugging layout
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
  },  contentWrapper: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : undefined,
    alignSelf: 'center',
  },  bar: {
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
  
});
