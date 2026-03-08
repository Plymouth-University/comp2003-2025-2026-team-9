import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

import { router } from 'expo-router';

import BlockSvg from '@/assets/icons/block.svg';
import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import { Profile, fetchDiscoveryProfiles, getCurrentUser, likeProfile, supabase, swipeOnProfile } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HandshakeIcon = require('@/assets/icons/handshake.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.70;

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
  const [enterFrom, setEnterFrom] = useState<'left' | 'right' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [matchIntro, setMatchIntro] = useState('');
  const [matchModalProfile, setMatchModalProfile] = useState<Profile | null>(null);

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

  // Load my own profile for match modal avatars
  useEffect(() => {
    let cancelled = false;
    const loadMe = async () => {
      try {
        const user = await getCurrentUser();
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, title, industry, bio, photo_url, role')
          .eq('id', user.id)
          .single();
        if (!cancelled && !error && data) {
          setMyProfile(data as Profile);
        }
      } catch (err) {
        console.error('Failed to load self profile', err);
      }
    };
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = profiles[index];
  const nextProfile = profiles[index + 1];
  const remaining = profiles.length - index - 1;

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
      // Register the like and attempt mutual match via RPC
      await likeProfile(id);

      // Verify an actual match row exists between me and the other user
      const me = await getCurrentUser();
      const { data: rows, error } = await supabase
        .from('peer_matches')
        .select('id')
        .or(
          `and(member_a.eq.${me.id},member_b.eq.${id}),` +
            `and(member_a.eq.${id},member_b.eq.${me.id})`,
        )
        .limit(1);

      if (!error && rows && rows.length > 0) {
        const other = profiles.find((p) => p.id === id);
        if (other) {
          setMatchIntro('');
          setMatchModalProfile(other);
        }
      }
    } catch (err) {
      console.error('Failed to like profile', err);
    }
  }, [profiles]);

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
    setEnterFrom('left');
    setIndex(idx);
    setLastPass(null);
  };

  const showEmpty = !loading && (!profiles.length || !current);

  const handleCloseMatchModal = () => {
    setMatchModalProfile(null);
    setMatchIntro('');
  };

  const handleSendIntroFromMatch = async () => {
    if (!matchModalProfile) return;
    try {
      const otherUserId = matchModalProfile.id;
      // Ensure a thread exists
      const { data, error } = await supabase.rpc('ensure_peer_thread', {
        other_user: otherUserId,
      });
      if (error) throw error;
      const threadId = data?.id as number | undefined;
      if (!threadId) return;

      const text = matchIntro.trim();
      if (text.length > 0) {
        const me = await getCurrentUser();
        const { error: msgError } = await supabase.from('messages').insert({
          thread_id: threadId,
          sender: me.id,
          body: text,
        });
        if (msgError) throw msgError;
      }

      const name = matchModalProfile.full_name ?? 'Peer';
      handleCloseMatchModal();
      router.push({
        pathname: '/(app)/Mentee/chat',
        params: {
          threadId: String(threadId),
          otherId: otherUserId,
          name,
        },
      });
    } catch (err) {
      console.error('Failed to send intro message from match', err);
    }
  };

   return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <ScreenHeader
            title="Discovery"
            highlight="Stack"
          />
          {lastPass && (
            <TouchableOpacity
              style={styles.undoButton}
              onPress={() => {
                handleUndoLastPass();
              }}
              activeOpacity={0.3}
            >
              <Text style={styles.undoButtonText}>Undo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Card area rendered above scrollable content so it can overlap the header */}
      {!loading && !showEmpty && (
        <View style={styles.cardArea} pointerEvents="box-none">
          <ProfileCard
            key={current?.id ?? 'no-profile'}
            profile={current}
            nextProfile={nextProfile}
            remaining={remaining}
            onOpenProfile={(id: string) => {
              router.push({
                pathname: '/(app)/Mentee/profile-view' as any,
                params: { userId: id },
              });
            }}
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
            enterFrom={enterFrom}
            onEnterComplete={() => setEnterFrom(null)}
            onSkipPress={() => {
              if (!swiping && current) setSwipeCommand('left');
            }}
            onConnectPress={() => {
              if (!swiping && current) setSwipeCommand('right');
            }}
          />
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
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
        ) : null}
      </ScrollView>

      {/* Match modal */}
      {matchModalProfile && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={handleCloseMatchModal}
        >
          <View style={styles.matchModalOverlay}>
            <View style={[styles.matchModalCard, { backgroundColor: theme.card }]}>
              <Text
                style={[
                  styles.matchTitle,
                  font('GlacialIndifference', '800'),
                  { color: theme.text },
                ]}
              >
                You found a connection!
              </Text>

              <View style={styles.matchAvatarsRow}>
                <View style={styles.matchAvatarBig}>
                  {myProfile?.photo_url ? (
                    <Image source={{ uri: myProfile.photo_url }} style={styles.matchAvatarImage} />
                  ) : (
                    <Text style={[styles.matchAvatarInitial, font('GlacialIndifference', '700')] }>
                      {(myProfile?.full_name ?? 'You').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.matchAmpersand}>&amp;</Text>
                <View style={styles.matchAvatarBig}>
                  {matchModalProfile.photo_url ? (
                    <Image
                      source={{ uri: matchModalProfile.photo_url }}
                      style={styles.matchAvatarImage}
                    />
                  ) : (
                    <Text style={[styles.matchAvatarInitial, font('GlacialIndifference', '700')] }>
                      {(matchModalProfile.full_name ?? 'Peer').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              </View>

              <Text
                style={[
                  styles.matchSubtitle,
                  font('GlacialIndifference', '400'),
                  { color: theme.text },
                ]}
              >
                You and {matchModalProfile.full_name ?? 'this member'} are now connected!
              </Text>

              <TextInput
                style={[styles.matchInput, { color: theme.text }]}
                placeholder="Send an introductory message"
                placeholderTextColor="#7f8186"
                value={matchIntro}
                onChangeText={setMatchIntro}
                multiline
              />

              <View style={styles.matchButtonsRow}>
                <TouchableOpacity
                  style={[styles.matchButton, styles.matchButtonSecondary]}
                  onPress={handleCloseMatchModal}
                >
                  <Text style={styles.matchButtonSecondaryText}>Not now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.matchButton, styles.matchButtonPrimary]}
                  onPress={handleSendIntroFromMatch}
                >
                  <Text style={styles.matchButtonPrimaryText}>Send &amp; open chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  onOpenProfile?: (id: string) => void;
  onSkipPress?: () => void;
  onConnectPress?: () => void;
  enterFrom?: 'left' | 'right' | null;
  onEnterComplete?: () => void;
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
  onOpenProfile,
  onSkipPress,
  onConnectPress,
  enterFrom,
  onEnterComplete,
}: ProfileCardProps) {
  const translateX = useSharedValue(
    enterFrom === 'left' ? -SCREEN_WIDTH * 1.2 :
    enterFrom === 'right' ? SCREEN_WIDTH * 1.2 : 0
  );
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  // Animate card sliding back into frame on undo
  useEffect(() => {
    if (enterFrom) {
      translateX.value = withTiming(0, { duration: 280 }, (finished) => {
        if (finished && onEnterComplete) {
          runOnJS(onEnterComplete)();
        }
      });
    }
  }, []);

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

  const renderProfileCardBody = (p: Profile) => {
    const chips = buildChips(p);
    const location = (p as any).location as string | undefined;

    return (
      <View style={styles.cardVertical}>
        {/* Photo */}
        <View style={styles.cardPhotoSection}>
          {p.photo_url ? (
            <Image source={{ uri: p.photo_url }} style={styles.cardPhoto} />
          ) : (
            <View
              style={[
                styles.cardPhotoPlaceholder,
                isDark && { backgroundColor: '#1b1f33' },
              ]}
            >
              <Text
                style={[
                  styles.cardPhotoInitial,
                  { color: isDark ? theme.text : '#5a5a5a' },
                ]}
              >
                {(p.full_name ?? 'A').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfoSection}>
          <Text
            style={[
              styles.cardName,
              font('GlacialIndifference', '800'),
              { color: theme.text },
            ]}
          >
            {p.full_name ?? 'Unknown Member'}
          </Text>
          {p.title && (
            <Text
              style={[
                styles.cardJobTitle,
                font('GlacialIndifference', '400'),
                { color: isDark ? '#cfd3ff' : '#555' },
              ]}
            >
              {p.title}
            </Text>
          )}
          {location && (
            <Text
              style={[
                styles.cardLocation,
                font('GlacialIndifference', '400'),
                { color: isDark ? '#aaa' : '#999' },
              ]}
            >
              {location}
            </Text>
          )}

          {chips.length > 0 && (
            <View style={styles.cardChipsRow}>
              {chips.map((chip) => (
                <View
                  key={chip}
                  style={[styles.cardChipPill, isDark && styles.cardChipPillDark]}
                >
                  <Text
                    style={[
                      styles.cardChipText,
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

          {(() => {
            const raw = p.looking_for;
            let items: string[] = [];
            if (Array.isArray(raw)) {
              items = raw.filter(Boolean);
            } else if (typeof raw === 'string' && raw.trim()) {
              items = raw.split(',').map((s) => s.trim()).filter(Boolean);
            }
            if (items.length === 0) return null;
            return (
              <>
                <Text
                  style={[
                    styles.cardSectionTitle,
                    font('GlacialIndifference', '700'),
                    { color: theme.text },
                  ]}
                >
                  I am looking for...
                </Text>
                <View style={styles.cardChipsRow}>
                  {items.map((item) => (
                    <View
                      key={item}
                      style={[styles.cardChip, isDark && styles.cardChipDark]}
                    >
                      <Text
                        style={[
                          styles.cardChipText,
                          font('GlacialIndifference', '400'),
                          { color: isDark ? '#e6e7ff' : '#4a4a4a' },
                        ]}
                        numberOfLines={1}
                      >
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            );
          })()}

          {p.bio && (
            <>
              <Text
                style={[
                  styles.cardSectionTitle,
                  font('GlacialIndifference', '700'),
                  { color: theme.text },
                ]}
              >
                Bio
              </Text>
              <Text
                style={[
                  styles.cardBio,
                  font('GlacialIndifference', '400'),
                  { color: isDark ? theme.text : '#555' },
                ]}
                numberOfLines={3}
              >
                {p.bio}
              </Text>
            </>
          )}

          {/* Skip / Connect buttons */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={[styles.cardActionButton, styles.skipButton]}
              onPress={onSkipPress}
              disabled={swiping}
              activeOpacity={0.7}
            >
              <BlockSvg width={18} height={18} color="#c55" fill="#c55" />
              <Text
                style={[
                  styles.skipButtonText,
                  font('GlacialIndifference', '700'),
                ]}
              >
                Skip
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cardActionButton, styles.connectButton]}
              onPress={onConnectPress}
              disabled={swiping}
              activeOpacity={0.7}
            >
              <Image source={HandshakeIcon} style={{ width: 38, height: 38 }} />
              <Text
                style={[
                  styles.connectButtonText,
                  font('GlacialIndifference', '700'),
                ]}
              >
                Connect
              </Text>
            </TouchableOpacity>
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
      {/* Third card in stack */}
      {remaining >= 2 && (
        <View
          style={[
            styles.card,
            styles.cardBehind2,
            isDark && styles.cardDark,
          ]}
        >
          <View style={styles.cardOverlay2} />
        </View>
      )}

      {/* Second card in stack */}
      {nextProfile && (
        <View
          style={[
            styles.card,
            styles.cardShadow,
            styles.cardBehind1,
            isDark && styles.cardDark,
          ]}
        >
          {renderProfileCardBody(nextProfile)}
          <View style={styles.cardOverlay1} />
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
          <TouchableOpacity
            activeOpacity={0.9}
            style={{ flex: 1 }}
            onPress={() => {
              if (!swiping && profile && onOpenProfile) {
                onOpenProfile(profile.id);
              }
            }}
          >
            {/* YES / NO badges */}
            <Animated.View style={[styles.badge, styles.badgeYes, yesLabelStyle]}>
              <Text style={styles.badgeText}>YES</Text>
            </Animated.View>
            <Animated.View style={[styles.badge, styles.badgeNo, noLabelStyle]}>
              <Text style={styles.badgeText}>NO</Text>
            </Animated.View>

            {renderProfileCardBody(profile)}
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },

  /* ───── Header ───── */
  headerSection: {
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  /* ───── Content ───── */
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: 80,
  },
  cardArea: {
    width: '100%',
    position: 'relative',
    zIndex: 200,
    elevation: 200,
    marginTop: 6,
  },

  /* ───── Card + arrows row ───── */
  cardWithArrows: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  /* ───── Profile card ───── */
  stackWrapper: {
    alignItems: 'center',
    paddingBottom: 20,
    position: 'relative',
    zIndex: 100,
    elevation: 100,
  },
  card: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: 18,
    backgroundColor: '#fff',
    overflow: 'hidden',
    zIndex: 20,
    elevation: 20,
  },
  cardDark: {
    backgroundColor: '#111524',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  cardBehind1: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: '94%',
    height: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 5,
  },
  cardBehind2: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    width: '88%',
    height: '100%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 3,
  },
  cardOverlay1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(150, 150, 150, 0.25)',
    borderRadius: 18,
  },
  cardOverlay2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(150, 150, 150, 0.45)',
    borderRadius: 18,
  },

  /* Card interior – vertical layout */
  cardVertical: {
    flex: 1,
    flexDirection: 'column',
  },
  cardPhotoSection: {
    width: '100%',
    height: CARD_HEIGHT * 0.35,
    backgroundColor: '#e8e8e8',
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardPhotoPlaceholder: {
    flex: 1,
    backgroundColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPhotoInitial: {
    fontSize: 52,
    fontWeight: '700',
    color: '#5a5a5a',
  },
  cardInfoSection: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  cardName: {
    fontSize: 22,
    marginBottom: 0,
  },
  cardJobTitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 0,
  },
  cardLocation: {
    fontSize: 13,
    color: '#999',
    marginBottom: 6,
  },
  cardChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  cardChip: {
    marginRight: 6,
    marginBottom: 4,
  },
  cardChipDark: {
  },
  cardChipPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f5f5f3',
    borderWidth: 1,
    borderColor: '#e0dfd5',
    marginRight: 6,
    marginBottom: 3,
  },
  cardChipPillDark: {
    backgroundColor: 'rgba(157, 168, 255, 0.18)',
    borderColor: '#9da8ff',
  },
  cardChipText: {
    fontSize: 13,
    color: '#4a4a4a',
  },
  cardSectionTitle: {
    fontSize: 14,
    marginTop: 6,
    marginBottom: 2,
  },
  cardBio: {
    fontSize: 14,
    lineHeight: 18,
    color: '#555',
  },

  /* ───── YES / NO swipe badges ───── */
  badge: {
    position: 'absolute',
    top: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
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

  /* ───── Action buttons (inside card) ───── */
  cardActionsRow: {
    flexDirection: 'row',
    columnGap: 10,
    marginTop: 'auto',
  },
  cardActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    columnGap: 8,
  },
  skipButton: {
    backgroundColor: '#f5e0e0',
  },
  skipButtonText: {
    color: '#c55',
    fontSize: 15,
  },
  connectButton: {
    backgroundColor: '#dceede',
  },
  connectButtonText: {
    color: '#5a7a5f',
    fontSize: 15,
  },

  /* ───── Undo ───── */
  undoButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#968c6c',
  },
  undoButtonText: {
    fontSize: 12,
    color: '#968c6c',
  },

  /* ───── Empty state ───── */
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
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

  /* ───── Match modal ───── */
  matchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchModalCard: {
    width: '88%',
    borderRadius: 24,
    padding: 20,
  },
  matchTitle: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  matchAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  matchAvatarBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  matchAvatarInitial: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  matchAmpersand: {
    marginHorizontal: 12,
    fontSize: 22,
    color: '#fff',
  },
  matchSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  matchInput: {
    minHeight: 60,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
  },
  matchButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  matchButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  matchButtonSecondary: {
    borderWidth: 1,
    borderColor: '#968c6c',
    backgroundColor: 'transparent',
  },
  matchButtonSecondaryText: {
    color: '#968c6c',
    fontSize: 14,
  },
  matchButtonPrimary: {
    backgroundColor: '#968c6c',
  },
  matchButtonPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
