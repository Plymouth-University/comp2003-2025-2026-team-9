import { router, usePathname, type Href } from 'expo-router';
import React, { JSX, useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarIcon, ChatIcon, SettingIcon, VideoIcon } from './MentorNavIcons';
import { NavBlankShape } from './NavBlankShape';
import { supabase } from '../../lib/supabase';
import { Text } from 'react-native';
import { Logo } from '@/components/Logo';

const VIEWBOX_WIDTH = 200.27968;
const VIEWBOX_HEIGHT = 53.78904;
const VIEWBOX_CIRCLE_CENTER_Y = 18.258205;
const NAV_SCALE = 1.3;
const BASE_NAV_WIDTH = 390; // keep nav height based on phone-ish width

type Props = {
  onHeightChange?: (height: number) => void;
};

export default function MentorBottomNav({ onHeightChange }: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const [navWidth, setNavWidth] = React.useState(() => Dimensions.get('window').width);

  const bottomInset = insets.bottom > 0 ? insets.bottom : 10;
  const bottomFillHeight = bottomInset;
  const width = navWidth;

  // Detect Android navigation buttons (vs gesture nav) and adjust layout.
  const NAV_BUTTONS_THRESHOLD = 20;
  const androidHasNavButtons = Platform.OS === 'android' && insets.bottom >= NAV_BUTTONS_THRESHOLD;
  const isLargeAndroidScreen = Platform.OS === 'android' && width >= 400;
  const largeScreenDrop = isLargeAndroidScreen ? 26 : 0;
  const backgroundBottom = androidHasNavButtons ? -85 + bottomInset - largeScreenDrop : -85 - largeScreenDrop;
  const largeScreenAdminLift = isLargeAndroidScreen ? 12 : 0;

  // Lift the interactive buttons slightly when nav buttons exist so they
  // don't visually collide with the system bar.
  const buttonLiftBase = androidHasNavButtons ? Math.max(6, Math.min(20, Math.round(bottomInset / 2))) : 0;

  const buttonLift = Math.max(0, buttonLiftBase - largeScreenDrop);
  const widthScale = (width / VIEWBOX_WIDTH) * NAV_SCALE;
  const designScale = (BASE_NAV_WIDTH / VIEWBOX_WIDTH) * NAV_SCALE;
  const scale = Math.min(widthScale, designScale);
  const svgHeight = VIEWBOX_HEIGHT * scale / 1.42;
  const contentMaxWidth = Platform.OS === 'web' ? 600 : width;
  const contentWidth = Math.min(width, contentMaxWidth);
  const fillerExtra = Platform.OS === 'web' ? 50 : 0;
  const fillerWidth = Platform.OS === 'web' ? Math.max(0, (width - contentWidth) / 2 + fillerExtra) : 0;
  const adminButtonBottom = bottomFillHeight + svgHeight / 2 - 10 + buttonLift + largeScreenAdminLift;

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
  type NavKey = (typeof tabs)[number]['key'] | 'admin';

  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('account_type, role')
          .eq('id', user.id)
          .maybeSingle();
        if (!error && data) {
          const admin = !!data.account_type || data.role === 'admin';
          setIsAdmin(admin);

          if (admin) {
            const { count } = await supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('approval_status', 'pending');
            setPendingCount(count ?? 0);
          }
        }
      } catch (err) {
        // ignore errors — default to non-admin
      }
    })();
  }, []);

  const goTo = (path: string, key: NavKey) => {
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
        const adminButtonExtent = adminButtonBottom + 56;
        const totalVisibleHeight = isAdmin ? Math.max(height, adminButtonExtent) : height;
        onHeightChange?.(totalVisibleHeight);
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
      {isAdmin && (
        <TouchableOpacity
          accessibilityLabel="Admin"
          onPress={() => goTo('/(app)/(admin)/admin', 'admin')}
        style={[
          styles.adminCircle,
          { bottom: adminButtonBottom },
        ]}
      >
          <Logo size={32} />
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
     
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
    bottom: -85,
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
  adminCircle: {
    position: 'absolute',
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333f5c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 20,
  },
  pendingBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
