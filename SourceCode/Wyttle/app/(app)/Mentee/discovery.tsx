import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import BlockSvg from '@/assets/icons/block.svg';
import HandshakeCircleSvg from '@/assets/icons/handshake-circle.svg';
import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import { Profile, fetchDiscoveryProfiles, likeProfile, swipeOnProfile } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

export default function DiscoveryStackScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [swipeCommand, setSwipeCommand] = useState<'left' | 'right' | null>(null);
  const [lastPass, setLastPass] = useState<{ profile: Profile; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastPass(null);
    try {
      const data = await fetchDiscoveryProfiles();
      setProfiles(data);
      setIndex(0);
    } catch (err: any) {
      console.error('Failed to load discovery profiles', err);
      setError(err.message ?? 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const current = profiles[index];
  const nextProfile = profiles[index + 1];
  const remaining = profiles.length - index - 1;
  const progress = profiles.length
    ? Math.min((index + 1) / profiles.length, 1)
    : 0;

  const handleSwipeStart = () => {
    if (!current || swiping) return;
    setSwiping(true);
  };

  const handlePass = useCallback(async (id: string) => {
    try {
      await swipeOnProfile(id, 'pass');
    } catch (err) {
      console.error('Failed to register pass', err);
    }
  }, []);

  const handleLike = useCallback(async (id: string) => {
    try {
      const match = await likeProfile(id);
      // if you ever want "It's a match!" popup:
      // if (match) { showMatchModal(match); }
    } catch (err) {
      console.error('Failed to like profile', err);
    }
  }, []);

  const handleSwipeCommandHandled = () => {
    setSwipeCommand(null);
  };

  const handleUndoLastPass = () => {
    if (!lastPass) return;
    const idx = profiles.findIndex((p) => p.id === lastPass.profile.id);
    if (idx === -1) {
      setLastPass(null);
      return;
    }
    setIndex(idx);
    setLastPass(null);
  };

  const showEmpty = !loading && (!profiles.length || !current);

   return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Discovery"
        highlight="Stack"
        subtitle="Discover other members to connect with."
      />

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" />
        ) : showEmpty ? (
          <View style={styles.emptyState}>
            <ThemedText
              style={[styles.emptyTitle, font('GlacialIndifference', '800')]}
            >
              You&apos;re all caught up
            </ThemedText>
            <ThemedText
              style={[
                styles.emptySubtitle,
                font('GlacialIndifference', '400'),
                { color: theme.text },
              ]}
            >
              Check back later for more members to discover.
            </ThemedText>
            <TouchableOpacity style={styles.secondaryButton} onPress={loadProfiles}>
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardArea}>
            {/* Progress */}
            <View style={styles.metaSection}>
              <View style={styles.progressRow}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progress * 100}%` },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.progressSubText,
                    font('GlacialIndifference', '400'),
                    { color: isDark ? '#cfd3ff' : '#777' },
                  ]}
                >
                  {remaining <= 0
                    ? 'Last one for now'
                    : `${remaining} more in this stack`}
                </Text>
              </View>
            </View>

            <ProfileCard
              key={current?.id ?? 'no-profile'}
              profile={current}
              nextProfile={nextProfile}
              remaining={remaining}
              onSwipeLeft={() => {
                if (!current) return;
                const swipedId = current.id;
                const swipedProfile = current;
                setLastPass({ profile: swipedProfile, index });
                setIndex((prev) => prev + 1);
                setSwiping(false);
                void handlePass(swipedId);
              }}
              onSwipeRight={() => {
                if (!current) return;
                const swipedId = current.id;
                setLastPass(null);
                setIndex((prev) => prev + 1);
                setSwiping(false);
                void handleLike(swipedId);
              }}
              onSwipeStart={handleSwipeStart}
              swipeCommand={swipeCommand}
              onSwipeCommandHandled={handleSwipeCommandHandled}
              swiping={swiping}
            />

            <View style={styles.belowCardInfo}>
            <Text
              style={[
                styles.matchTagline,
                font('GlacialIndifference', '400'),
                { color: isDark ? theme.text : '#666' },
              ]}
            >
              {current?.industry
                ? `Members interested in ${current.industry}.`
                : 'Members to grow and learn alongside you.'}
            </Text>
            </View>

            {lastPass && (
              <TouchableOpacity
                style={styles.undoButton}
                onPress={handleUndoLastPass}
                activeOpacity={0.8}
              >
                <Text style={styles.undoButtonText}>Undo last skip</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionsSection}>
              <View style={styles.actionsRow}>
                <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.circleButton, styles.passButton]}
            onPress={() => {
              if (!swiping && current) {
                setSwipeCommand('left');
              }
            }}
            disabled={swiping}
          >
            <BlockSvg width={64} height={64} color="#333f5c" />
          </TouchableOpacity>
            <Text
              style={[
                styles.actionLabel,
                font('GlacialIndifference', '400'),
                { color: isDark ? theme.text : '#555' },
              ]}
            >
              Skip
            </Text>
                </View>

                <View style={styles.actionItem}>
          <TouchableOpacity
            style={[styles.circleButton, styles.likeButton]}
            onPress={() => {
              if (!swiping && current) {
                setSwipeCommand('right');
              }
            }}
            disabled={swiping}
          >
            <HandshakeCircleSvg width={64} height={64} color="#333f5c" />
          </TouchableOpacity>
            <Text
              style={[
                styles.actionLabel,
                font('GlacialIndifference', '400'),
                { color: isDark ? theme.text : '#555' },
              ]}
            >
              Connect
            </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

type ProfileCardProps = {
  profile: Profile;
  nextProfile?: Profile;
  remaining: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeStart?: () => void;
  swipeCommand?: 'left' | 'right' | null;
  onSwipeCommandHandled?: () => void;
  swiping: boolean;
};

function ProfileCard({
  profile,
  nextProfile,
  remaining,
  onSwipeLeft,
  onSwipeRight,
  onSwipeStart,
  swipeCommand,
  onSwipeCommandHandled,
  swiping,
}: ProfileCardProps) {
  const translateX = useSharedValue(0);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const formatRoleLabel = (role: Profile['role'] | string | null) => {
    if (!role) return null;
    if (role === 'mentor') return 'Mentor';
    if (role === 'member' || role === 'mentee') return 'Member';
    return 'Admin';
  };

  const buildChips = (p: Profile): string[] => {
    const chips: string[] = [];

    if (p.industry) {
      chips.push(p.industry);
    }

    if (p.title) {
      const firstWord = p.title.split(' ')[0];
      if (firstWord && !chips.includes(firstWord)) {
        chips.push(firstWord);
      }
    }

    // Role is shown in a dedicated pill next to the remaining count, not as a chip
    return chips.slice(0, 3);
  };

  const renderProfileCardBody = (p: Profile, rem: number) => {
    const firstName = p.full_name?.split(' ')[0] ?? 'Anonymous';
    const chips = buildChips(p);
    const roleLabel = formatRoleLabel(p.role);

    return (
      <View style={styles.cardRow}>
        {/* Left: photo */}
        <View style={styles.cardLeft}>
          <View style={styles.avatarWrapper}>
            {p.photo_url ? (
              <Image source={{ uri: p.photo_url }} style={styles.avatarImage} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  isDark && { backgroundColor: '#1b1f33' },
                ]}
              >
                <Text
                  style={[
                    styles.avatarInitial,
                    { color: isDark ? theme.text : '#5a5a5a' },
                  ]}
                >
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Right: info */}
        <View style={styles.cardRight}>
          {/* Name + title */}
          <View style={styles.textBlock}>
            <Text
              style={[
                styles.nameText,
                font('GlacialIndifference', '800'),
                { color: theme.text },
              ]}
            >
              {p.full_name ?? 'Unknown Member'}
            </Text>
            {p.title && (
              <Text
                style={[
                  styles.titleText,
                  font('GlacialIndifference', '400'),
                  { color: isDark ? '#cfd3ff' : '#666' },
                ]}
              >
                {p.title}
              </Text>
            )}
          </View>

          {/* Mini stats row: show industry only under the name */}
          {p.industry && (
            <View style={styles.statsRow}>
              <Text
                style={[
                  styles.statText,
                  font('GlacialIndifference', '400'),
                  { color: isDark ? '#cfd3ff' : '#666' },
                ]}
                numberOfLines={1}
              >
                {p.industry}
              </Text>
            </View>
          )}

          {/* Bio + interest chips + CTA */}
          <View style={styles.bottomBlock}>
            {p.bio && (
              <Text
                style={[
                  styles.bottomLine,
                  styles.bottomBio,
                  font('GlacialIndifference', '400'),
                  { color: isDark ? theme.text : '#555' },
                ]}
                numberOfLines={3}
              >
                {p.bio}
              </Text>
            )}

            {chips.length > 0 && (
              <View style={styles.chipsRow}>
                {chips.map((chip) => (
                  <View key={chip} style={styles.chip}>
                    <Text
                      style={[
                        styles.chipText,
                        font('GlacialIndifference', '400'),
                        { color: isDark ? '#e6e7ff' : '#4a4a4a' },
                      ]}
                      numberOfLines={1}
                    >
                      {chip}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text
              style={[
                styles.cardHintText,
                font('GlacialIndifference', '400'),
                { color: isDark ? '#cfd3ff' : '#777' },
              ]}
            >
              Tap connect if you&apos;d like to meet {firstName}.
            </Text>
          </View>

          {/* Remaining indicator + role pill */}
          <View style={styles.remainingRow}>
            {roleLabel && (
              <View style={[styles.roleBadge, isDark && styles.roleBadgeDark]}>
                <Text
                  style={[
                    styles.roleBadgeText,
                    font('GlacialIndifference', '400'),
                    { color: isDark ? '#e6e7ff' : '#555' },
                  ]}
                  numberOfLines={1}
                >
                  {roleLabel}
                </Text>
              </View>
            )}
            <View style={[styles.remainingBadge, isDark && styles.remainingBadgeDark]}>
              <Text
                style={[
                  styles.remainingText,
                  { color: isDark ? '#f8f9ff' : '#555' },
                ]}
              >
                {rem} more
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const startSwipeAnimation = (direction: 'left' | 'right') => {
    const toValue = direction === 'right' ? SCREEN_WIDTH * 1.2 : -SCREEN_WIDTH * 1.2;

    translateX.value = withTiming(toValue, { duration: 220 }, (finished) => {
      if (!finished) return;

      if (direction === 'right' && onSwipeRight) {
        runOnJS(onSwipeRight)();
      } else if (direction === 'left' && onSwipeLeft) {
        runOnJS(onSwipeLeft)();
      }
      // Do not reset translateX here; the parent will advance to the next
      // profile and remount the card contents.
    });
  };

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = (translateX.value / SCREEN_WIDTH) * 12; // degrees
    const lift = -Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1) * 20; // px up
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: lift },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const yesLabelStyle = useAnimatedStyle(() => {
    const progress = Math.max(translateX.value, 0) / SWIPE_THRESHOLD;
    return {
      opacity: Math.min(progress, 1),
    };
  });

  const noLabelStyle = useAnimatedStyle(() => {
    const progress = Math.max(-translateX.value, 0) / SWIPE_THRESHOLD;
    return {
      opacity: Math.min(progress, 1),
    };
  });

  const gesture = Gesture.Pan()
    .enabled(!swiping)
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd(() => {
      const shouldDismiss = Math.abs(translateX.value) > SWIPE_THRESHOLD;

      if (!shouldDismiss) {
        translateX.value = withSpring(0);
        return;
      }

      const direction: 'left' | 'right' = translateX.value > 0 ? 'right' : 'left';

      if (onSwipeStart) {
        runOnJS(onSwipeStart)();
      }

      const toValue = direction === 'right' ? SCREEN_WIDTH * 1.2 : -SCREEN_WIDTH * 1.2;

      translateX.value = withTiming(toValue, { duration: 220 }, (finished) => {
        if (!finished) return;

        if (direction === 'right' && onSwipeRight) {
          runOnJS(onSwipeRight)();
        } else if (direction === 'left' && onSwipeLeft) {
          runOnJS(onSwipeLeft)();
        }
        // No reset here; once the parent advances the index, this card
        // instance will unmount and a fresh one will render for the next
        // profile.
      });
    });

  // Trigger swipe from buttons
  useEffect(() => {
    if (!swipeCommand) return;

    onSwipeStart?.();
    startSwipeAnimation(swipeCommand);
    onSwipeCommandHandled?.();
  }, [swipeCommand, onSwipeCommandHandled, onSwipeStart]);

  return (
    <View style={styles.stackWrapper}>
      {/* Next profile underneath */}
      {nextProfile && (
        <View
          style={[
            styles.card,
            styles.cardShadow,
            styles.cardBehind1,
            isDark && styles.cardDark,
          ]}
        >
          {renderProfileCardBody(nextProfile, Math.max(remaining - 1, 0))}
        </View>
      )}

      {/* Top card */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.card,
            styles.cardShadow,
            animatedCardStyle,
            isDark && styles.cardDark,
          ]}
        >
          {/* YES / NO badges */}
          <Animated.View style={[styles.badge, styles.badgeYes, yesLabelStyle]}>
            <Text style={styles.badgeText}>YES</Text>
          </Animated.View>
          <Animated.View style={[styles.badge, styles.badgeNo, noLabelStyle]}>
            <Text style={styles.badgeText}>NO</Text>
          </Animated.View>

          {renderProfileCardBody(profile, remaining)}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
type NavIconProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

function NavIcon({ label, active, onPress }: NavIconProps) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress} disabled={active || !onPress}>
      <View style={[styles.navDot, active && styles.navDotActive]} />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  header: {
    marginTop: 16,
    marginBottom: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  cardArea: {
    flex: 1,
    width: '100%',
    paddingTop: 4,
  },
  stackWrapper: {
    alignItems: 'center',
    marginTop: 4,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    overflow: 'hidden',
    minHeight: 260,
  },
  cardDark: {
    backgroundColor: '#111524',
  },
  metaSection: {
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#e0dfd5',
    overflow: 'hidden',
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#968c6c',
  },
  progressText: {
    fontSize: 14,
    color: '#555',
  },
  progressSubText: {
    fontSize: 12,
    color: '#777',
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f0eee5',
    marginRight: 8,
    marginBottom: 4,
  },
  filterPillActive: {
    backgroundColor: '#968c6c',
  },
  filterPillText: {
    fontSize: 12,
    color: '#555',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  helperText: {
    fontSize: 12,
    color: '#777',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flex: 1,
  },
  cardLeft: {
    width: '42%',
    alignSelf: 'stretch',
  },
  cardRight: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  cardBehind1: {
    position: 'absolute',
    top: 16,
    width: '92%',
    opacity: 0.4,
  },
  cardBehind2: {
    position: 'absolute',
    top: 28,
    width: '85%',
    opacity: 0.25,
  },
  badge: {
    position: 'absolute',
    top: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    zIndex: 10,
    elevation: 10,
  },
  badgeYes: {
    left: 16,
    backgroundColor: '#e3f1e6',
  },
  badgeNo: {
    right: 16,
    backgroundColor: '#f3e4e4',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  avatarWrapper: {
    flex: 1,
    width: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    width: '100%',
    backgroundColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '700',
    color: '#5a5a5a',
  },
  textBlock: {
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  nameText: {
    fontSize: 22,
    marginBottom: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  statDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 6,
    backgroundColor: '#b0a78e',
  },
  titleText: {
    fontSize: 16,
    color: '#666',
  },
  bottomBlock: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  bottomLine: {
    fontSize: 14,
    color: '#555',
  },
  bottomBio: {
    marginTop: 0,
    textAlign: 'left',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e0dfd5',
    backgroundColor: '#f9f9f7',
    marginRight: 6,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 12,
    color: '#4a4a4a',
  },
  cardHintText: {
    marginTop: 6,
    fontSize: 12,
    color: '#777',
  },
  remainingRow: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f0eee5',
    marginRight: 8,
  },
  roleBadgeDark: {
    backgroundColor: 'rgba(157, 168, 255, 0.24)',
    borderWidth: 1,
    borderColor: '#9da8ff',
  },
  roleBadgeText: {
    fontSize: 12,
    color: '#555',
  },
  remainingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e0dfd5',
  },
  remainingBadgeDark: {
    backgroundColor: 'rgba(157, 168, 255, 0.32)',
    borderWidth: 1,
    borderColor: '#9da8ff',
  },
  remainingText: {
    fontSize: 12,
    color: '#555',
  },
  belowCardInfo: {
    marginTop: 76,
    marginBottom: 2,
    alignItems: 'center',
  },
  matchTagline: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  undoButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#968c6c',
    marginBottom: 8,
  },
  undoButtonText: {
    fontSize: 12,
    color: '#968c6c',
  },
  actionsSection: {
    marginTop: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
    marginBottom: 0,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#555',
  },
  circleButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passButton: {
    backgroundColor: '#f3e4e4',
  },
  likeButton: {
    backgroundColor: '#e3f1e6',
  },
  circleButtonText: {
    fontSize: 26,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#777',
    marginBottom: 16,
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#968c6c',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#968c6c',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  navItem: {
    alignItems: 'center',
  },
  navDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
  navDotActive: {
    backgroundColor: '#968c6c',
  },
  navLabel: {
    fontSize: 10,
    color: '#777',
  },
  navLabelActive: {
    color: '#000',
    fontWeight: '600',
  },
});
