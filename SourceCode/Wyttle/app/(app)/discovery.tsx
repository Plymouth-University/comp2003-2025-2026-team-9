import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/BackButton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../src/lib/fonts';
import { Profile, fetchDiscoveryProfiles, likeProfile, swipeOnProfile } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

export default function DiscoveryStackScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  const handlePass = async () => {
  if (!current || swiping) return;
  setSwiping(true);
  try {
    await swipeOnProfile(current.id, 'pass');
    setIndex((prev) => prev + 1);
  } finally {
    setSwiping(false);
  }
};


  const handleLike = async () => {
  if (!current || swiping) return;
  setSwiping(true);
  try {
    const match = await likeProfile(current.id);
    // if you ever want "It's a match!" popup:
    // if (match) { showMatchModal(match); }
    setIndex((prev) => prev + 1);
  } finally {
    setSwiping(false);
  }
};


  const showEmpty = !loading && (!profiles.length || !current);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <BackButton />

      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={[styles.title, font('SpaceGrotesk', '600')]}>
          Discovery <Text style={{ fontWeight: '900' }}>Stack</Text>
        </ThemedText>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" />
        ) : showEmpty ? (
          <View style={styles.emptyState}>
            <ThemedText style={[styles.emptyTitle, font('GlacialIndifference', '800')]}>
              You&apos;re all caught up
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, font('GlacialIndifference', '400')]}>
              Check back later for more members to discover.
            </ThemedText>
            <TouchableOpacity style={styles.secondaryButton} onPress={loadProfiles}>
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ProfileCard profile={current} remaining={profiles.length - index - 1} />
        )}
      </View>

      {/* Actions */}
      {!loading && !showEmpty && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.circleButton, styles.passButton]}
            onPress={handlePass}
            disabled={swiping}
          >
            <Text style={styles.circleButtonText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.circleButton, styles.likeButton]}
            onPress={handleLike}
            disabled={swiping}
          >
            <Text style={styles.circleButtonText}>🤝</Text>
          </TouchableOpacity>
        </View>
      )}      
    </View>
  );
}

type ProfileCardProps = {
  profile: Profile;
  remaining: number;
};

function ProfileCard({ profile, remaining }: ProfileCardProps) {
  const firstName = profile.full_name?.split(' ')[0] ?? 'Anonymous';

  return (
    <View style={styles.stackWrapper}>
      {/* "Stacked" ghost cards behind */}
      <View style={[styles.card, styles.cardShadow, styles.cardBehind2]} />
      <View style={[styles.card, styles.cardShadow, styles.cardBehind1]} />

      {/* Top card */}
      <View style={[styles.card, styles.cardShadow]}>
        {/* Headshot placeholder */}
        <View style={styles.avatarWrapper}>
          {profile.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Name + title */}
        <View style={styles.textBlock}>
          <Text style={[styles.nameText, font('GlacialIndifference', '800')]}>
            {profile.full_name ?? 'Unknown Member'}
          </Text>
          {profile.title && (
            <Text style={[styles.titleText, font('GlacialIndifference', '400')]}>
              {profile.title}
            </Text>
          )}
        </View>

        {/* Bio/industry */}
        <View style={styles.bottomBlock}>
          {profile.industry && (
            <Text style={[styles.bottomLine, font('GlacialIndifference', '400')]}>
              {profile.industry}
            </Text>
          )}
          {profile.bio && (
            <Text
              style={[styles.bottomLine, styles.bottomBio, font('GlacialIndifference', '400')]}
              numberOfLines={2}
            >
              {profile.bio}
            </Text>
          )}
        </View>

        {/* Remaining indicator */}
        <View style={styles.remainingBadge}>
          <Text style={styles.remainingText}>{remaining} more</Text>
        </View>
      </View>
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
    paddingBottom: 12,
  },
  header: {
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  stackWrapper: {
    alignItems: 'center',
  },
  card: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    paddingVertical: 24,
    paddingHorizontal: 20,
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
  avatarWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '700',
    color: '#5a5a5a',
  },
  textBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  nameText: {
    fontSize: 22,
    marginBottom: 4,
  },
  titleText: {
    fontSize: 16,
    color: '#666',
  },
  bottomBlock: {
    marginTop: 8,
    alignItems: 'center',
  },
  bottomLine: {
    fontSize: 14,
    color: '#555',
  },
  bottomBio: {
    marginTop: 4,
    textAlign: 'center',
  },
  remainingBadge: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e0dfd5',
  },
  remainingText: {
    fontSize: 12,
    color: '#555',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 16,
    marginBottom: 8,
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
