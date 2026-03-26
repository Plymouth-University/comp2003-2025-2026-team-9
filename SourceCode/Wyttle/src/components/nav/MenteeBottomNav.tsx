import { router, usePathname, useGlobalSearchParams, type Href } from 'expo-router';
import React, { JSX, useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMenteeNavBadgeCounts } from '../../lib/nav-badges';
import { subscribeToMenteeBadgeState } from '../../lib/nav-badge-state';
import { supabase } from '../../lib/supabase';
import { subscribeToLocalReadUpdates } from '../../lib/chat-read-state';
import { GraduationIcon, SettingIcon, StackIcon, UsersAltIcon } from './MenteeNavIcons';
import { NavBlankShape } from './NavBlankShape';

const VIEWBOX_WIDTH = 200.27968;
const NAV_SCALE = 1.3;
const BASE_NAV_WIDTH = 390; // keep nav height based on phone-ish width
type Props = {
  onHeightChange?: (height: number) => void;
};

export default function MenteeBottomNav({ onHeightChange }: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const navOrigin = typeof searchParams?.navOrigin === 'string' ? searchParams.navOrigin : null;

  const [navWidth, setNavWidth] = React.useState(() => Dimensions.get('window').width);
  const [badgeCounts, setBadgeCounts] = useState({
    connections: 0,
    mentorHub: 0,
  });
  const trackedThreadIdsRef = useRef<Set<number>>(new Set());

  const bottomInset = insets.bottom > 0 ? insets.bottom : 10;
  const bottomFillHeight = bottomInset ;
  const width = navWidth;

  // Detect whether Android is using the old bottom navigation buttons
  // vs gesture navigation. When the bottom buttons are present the
  // safe-area inset will be non-zero and typically larger than a
  // small threshold (nav bars are usually ~48dp tall). Use this to
  // tweak the SVG background vertical offset so the nav looks correct.
  const NAV_BUTTONS_THRESHOLD = 20;
  const androidHasNavButtons = Platform.OS === 'android' && insets.bottom >= NAV_BUTTONS_THRESHOLD;
  const isLargeAndroidScreen = Platform.OS === 'android' && width >= 400;
  const largeScreenDrop = isLargeAndroidScreen ? 26 : 0;
  const backgroundBottom = androidHasNavButtons ? -85 + bottomInset - largeScreenDrop : -85 - largeScreenDrop;

  // When Android has the navigation buttons, lift the interactive
  // button row upward slightly so it sits above the system bar and
  // doesn't overlap the visual nav background.
  const buttonLiftBase = androidHasNavButtons ? Math.max(6, Math.min(20, Math.round(bottomInset / 2))) : 0;

  // Compute vertical offset so the active circle aligns with the SVG bump center.
  // Use the same clamped vertical scale as NavBlankShape so the circle stays
  // aligned even on very wide screens.
  const buttonLift = Math.max(0, buttonLiftBase - largeScreenDrop);
  const widthScale = (width / VIEWBOX_WIDTH) * NAV_SCALE;
  const designScale = (BASE_NAV_WIDTH / VIEWBOX_WIDTH) * NAV_SCALE;
  const scale = Math.min(widthScale, designScale);
  const CROPPED_VIEWBOX_HEIGHT = 37.91404;
  const svgHeight = CROPPED_VIEWBOX_HEIGHT * scale;
  const contentMaxWidth = Platform.OS === 'web' ? 600 : width;
  const contentWidth = Math.min(width, contentMaxWidth);
  const fillerExtra = Platform.OS === 'web' ? 50 : 0;
  const fillerWidth = Platform.OS === 'web' ? Math.max(0, (width - contentWidth) / 2 + fillerExtra) : 0;
  type NavKey = 'connections' | 'discovery' | 'mentorHub' | 'settings';

  // Derive active tab from the last pathname segment so it works reliably
  // regardless of group segments like "(app)".
  const [pathWithoutQuery] = pathname.split('?');
  const segments = pathWithoutQuery.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? 'connections';

  let activeKey: NavKey = 'connections';
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
    case 'profile-view':
      activeKey = navOrigin === 'mentor-hub' ? 'mentorHub' : 'connections';
      break;
    default:
      activeKey = 'connections';
  }

  const active = activeKey;

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const loadBadgeCounts = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        const counts = await getMenteeNavBadgeCounts(user.id);
        if (isMounted) {
          trackedThreadIdsRef.current = new Set(counts.trackedThreadIds);
          setBadgeCounts(counts);
        }
      } catch (error) {
        console.warn('Failed to load mentee nav badge counts', error);
      }
    };

    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      channel = supabase
        .channel(`mentee-nav-badges-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const threadId = Number((payload.new as any)?.thread_id);
          if (trackedThreadIdsRef.current.has(threadId)) {
            void loadBadgeCounts();
          }
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mentor_requests', filter: `mentee=eq.${user.id}` },
          () => {
            void loadBadgeCounts();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'peer_matches', filter: `member_a=eq.${user.id}` },
          () => {
            void loadBadgeCounts();
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'peer_matches', filter: `member_b=eq.${user.id}` },
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
    void setupRealtime();
    const unsubscribeLocalReceiptUpdates = subscribeToLocalReadUpdates(() => {
      if (isMounted) {
        void loadBadgeCounts();
      }
    });
    const unsubscribeBadgeState = subscribeToMenteeBadgeState((nextState) => {
      if (!isMounted) return;
      setBadgeCounts((current) => ({
        connections: nextState.connections ?? current.connections,
        mentorHub: nextState.mentorHub ?? current.mentorHub,
      }));
    });

    return () => {
      isMounted = false;
      unsubscribeLocalReceiptUpdates();
      unsubscribeBadgeState();
      if (channel) {
        supabase.removeChannel(channel);
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
              badgeCount={badgeCounts.connections}
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
              badgeCount={badgeCounts.mentorHub}
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
  badgeCount?: number;
  onPress: () => void;
};

function NavItem({ Icon, active, badgeCount = 0, onPress }: NavItemProps) {
  const color = active ? '#968c6c' : '#dedfe0';

  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Icon color={color} size={30} />
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
});
