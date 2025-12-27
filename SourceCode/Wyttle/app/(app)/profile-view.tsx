import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { router } from 'expo-router';
import { BackButton } from '@/components/ui/BackButton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../src/lib/fonts';
import { supabase, disconnectPeer, getCurrentUser } from '../../src/lib/supabase';
import type { Profile } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

export default function ProfileViewScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : null;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canDisconnect, setCanDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) {
        setError('Missing user id');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, title, industry, bio, photo_url, role, location, skills, interests')
          .eq('id', userId)
          .single();
        if (cancelled) return;
        if (profileError) {
          console.error('Failed to load profile', profileError);
          setError(profileError.message ?? 'Failed to load profile');
          return;
        }
        setProfile(data as Profile);

        // Check if the current user is matched with this user via peer_matches
        try {
          const me = await getCurrentUser();
          const { data: matches, error: matchError } = await supabase
            .from('peer_matches')
            .select('id')
            .or(
              `and(member_a.eq.${me.id},member_b.eq.${userId}),` +
                `and(member_a.eq.${userId},member_b.eq.${me.id})`,
            );
          if (!matchError && matches && matches.length > 0) {
            setCanDisconnect(true);
          }
        } catch (e) {
          console.warn('Failed to check match status', e);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load profile', err);
        setError(err.message ?? 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Member';

  const handleDisconnect = async () => {
    if (!userId) return;
    try {
      setDisconnecting(true);
      await disconnectPeer(userId);
      setCanDisconnect(false);
      router.back();
    } catch (err) {
      console.error('Failed to disconnect', err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.headerRow}>
        <BackButton />
        <Text
          style={[
            styles.headerTitle,
            font('GlacialIndifference', '800'),
            { color: theme.text },
          ]}
        >
          Profile
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={{ color: 'red' }}>{error}</Text>
        </View>
      ) : !profile ? (
        <View style={styles.centerContent}>
          <Text>No profile found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Top cover image (large) */}
          <View style={styles.topImageWrapper}>
            {profile.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.topImage} />
            ) : (
              <View style={styles.topImagePlaceholder}>
                <Text style={styles.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>

          {/* Chips row: location (left) and title (right / full-width on small screens) */}
          <View style={styles.chipsRow}>
            {profile.location ? (
              <View style={styles.chipBadge}>
                <Text style={styles.chipBadgeText}>{profile.location}</Text>
              </View>
            ) : null}

            {profile.title ? (
              <View style={[styles.chipBadge, styles.chipBadgeTitle]}>
                <Text style={styles.chipBadgeText}>{profile.title}</Text>
              </View>
            ) : null}
          </View>

          {/* Name (larger) */}
          <Text
            style={[
              styles.nameLarge,
              font('GlacialIndifference', '800'),
              { color: theme.text },
            ]}
          >
            {profile.full_name ?? 'Member'}
          </Text>

          {/* About section header */}
          <Text
            style={[
              styles.aboutTitle,
              font('GlacialIndifference', '800'),
              { color: theme.text },
            ]}
          >
            About Me
          </Text>

          {/* Bio */}
          {profile.bio ? (
            <Text
              style={[
                styles.sectionBody,
                font('GlacialIndifference', '400'),
              ]}
            >
              {profile.bio}
            </Text>
          ) : null}

          {(Array.isArray((profile as any).skills) && (profile as any).skills.length > 0) && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  font('GlacialIndifference', '800'),
                  { color: theme.text },
                ]}
              >
                Skills / study
              </Text>
              <View style={styles.chipRow}>
                {(profile as any).skills.map((s: string) => (
                  <View key={s} style={styles.chip}>
                    <Text style={styles.chipText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {(Array.isArray((profile as any).interests) && (profile as any).interests.length > 0) && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  font('GlacialIndifference', '800'),
                  { color: theme.text },
                ]}
              >
                Interests / hobbies
              </Text>
              <View style={styles.chipRow}>
                {(profile as any).interests.map((s: string) => (
                  <View key={s} style={styles.chip}>
                    <Text style={styles.chipText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {canDisconnect && (
            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={handleDisconnect}
              disabled={disconnecting}
            >
              <Text style={styles.disconnectButtonText}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    marginLeft: 12,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
    // Top large image
  topImageWrapper: {
    width: '99%',
    aspectRatio: 1,
    borderRadius: 14,
    borderColor: '#000000',
    borderWidth: 3,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#e9e9e9',
    alignSelf: 'stretch',
    
  },
  topImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    
  },
  topImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#cfcfcf',
  },

  avatarInitial: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },

  // chips row under the top image
  chipsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  chipBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#333f5c',
    borderWidth: 1,
    borderColor: '#000000',
    marginRight: 8,
  },
  chipBadgeTitle: {
    // allow the title chip to visually stretch more on small screens
    flex: 1,
    alignItems: 'center',
  },
  chipBadgeText: {
    fontSize: 13,
    color: '#ffffff',
  },

  // larger name and about heading
  nameLarge: {
    fontSize: 28,
    marginTop: 4,
    marginBottom: 6,
    textAlign: 'left',
    width: '100%',
  },
  aboutTitle: {
    fontSize: 18,
    marginTop: 12,
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    color: '#777',
    marginBottom: 2,
  },
  section: {
    width: '100%',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 14,
    color: '#555',
    marginTop: 12,
  },
  disconnectButton: {
    marginTop: 24,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#c43b3b',
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f0eee5',
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: {
    fontSize: 12,
    color: '#555',
  },
});
