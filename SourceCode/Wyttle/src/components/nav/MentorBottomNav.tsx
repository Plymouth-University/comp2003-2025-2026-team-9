import { router, usePathname, useGlobalSearchParams, type Href } from 'expo-router';
import React, { JSX, useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarIcon, ChatIcon, SettingIcon, VideoIcon } from './MentorNavIcons';
import { NavBlankShape } from './NavBlankShape';
import { getMentorNavBadgeCounts } from '../../lib/nav-badges';
import { supabase } from '../../lib/supabase';
import { subscribeToLocalReadUpdates } from '../../lib/chat-read-state';
import { Logo } from '@/components/Logo';

const VIEWBOX_WIDTH = 200.27968;
const VIEWBOX_HEIGHT = 53.78904;
const NAV_SCALE = 1.3;
const BASE_NAV_WIDTH = 390; // keep nav height based on phone-ish width

type Props = {
  onHeightChange?: (height: number) => void;
};

export default function MentorBottomNav({ onHeightChange }: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const navOrigin = typeof searchParams?.navOrigin === 'string' ? searchParams.navOrigin : null;

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

  type BaseNavKey = 'waiting' | 'connections' | 'calendar' | 'settings';

  // Derive active tab from the last pathname segment so it works reliably
  // regardless of group segments like "(app)".
  const [pathWithoutQuery] = pathname.split('?');
  const segments = pathWithoutQuery.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? 'connections';

  let activeKey: BaseNavKey = 'connections';
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
    case 'profile-view':
      activeKey = navOrigin === 'settings' ? 'settings' : 'connections';
      break;
    default:
      activeKey = 'connections';
  }

  const active = activeKey;
  type NavKey = BaseNavKey | 'admin';

  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [badgeCounts, setBadgeCounts] = useState({
    connections: 0,
    waiting: 0,
  });
  const trackedThreadIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let isMounted = true;
    let badgeChannel: ReturnType<typeof supabase.channel> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

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
      } catch {
        // ignore errors — default to non-admin
      }
    })();

    const loadBadgeCounts = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        const counts = await getMentorNavBadgeCounts(user.id);
        if (isMounted) {
          trackedThreadIdsRef.current = new Set(counts.trackedThreadIds);
          setBadgeCounts(counts);
        }
      } catch (error) {
        console.warn('Failed to load mentor nav badge counts', error);
      }
    };

    const setupBadgeRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      badgeChannel = supabase
        .channel(`mentor-nav-badges-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const threadId = Number((payload.new as any)?.thread_id);
          if (trackedThreadIdsRef.current.has(threadId)) {
            void loadBadgeCounts();
          }
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mentor_requests', filter: `mentor=eq.${user.id}` },
          () => {
            void loadBadgeCounts();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'thread_memberships', filter: `user_id=eq.${user.id}` },
          () => {
            void loadBadgeCounts();
          },
        )
        .subscribe();
    };

    void loadBadgeCounts();
    void setupBadgeRealtime();
    const unsubscribeLocalReceiptUpdates = subscribeToLocalReadUpdates(() => {
      if (isMounted) {
        void loadBadgeCounts();
      }
    });
    pollInterval = setInterval(() => {
      if (isMounted) {
        void loadBadgeCounts();
      }
    }, 3000);

    return () => {
      isMounted = false;
      unsubscribeLocalReceiptUpdates();
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (badgeChannel) {
        supabase.removeChannel(badgeChannel);
      }
    };
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
              badgeCount={badgeCounts.waiting}
              onPress={() => goTo('/(app)/Mentor/waiting-room', 'waiting')}
              size={40}
            />
            <NavItem
              Icon={ChatIcon}
              active={active === 'connections'}
              badgeCount={badgeCounts.connections}
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
  badgeCount?: number;
  onPress: () => void;
  size?: number;
};

function NavItem({ Icon, active, badgeCount = 0, onPress, size = 30 }: NavItemProps) {
  const color = active ? '#968c6c' : '#dedfe0';

  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Icon color={color} size={size} />
      {badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
        </View>
      ) : null}
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
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: '#d64545',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
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
