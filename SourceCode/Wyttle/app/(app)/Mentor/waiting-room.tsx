import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cancelSession } from '../../../src/lib/sessions';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router, useFocusEffect } from 'expo-router';
import { font } from '../../../src/lib/fonts';
import { fetchBlockedUserIds, supabase } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

type UpcomingSession = {
  requestId: number;
  menteeName: string;
  menteePhoto: string | null;
  scheduledStart: string;
  videoLink: string | null;
  description: string | null;
};

export default function MentorWaitingRoomScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [now, setNow] = useState(Date.now());

  // Tick every 30s for live countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const blockedIds = new Set(await fetchBlockedUserIds());

      const { data, error } = await supabase
        .from('mentor_requests')
        .select('id, mentee, scheduled_start, video_link, description')
        .eq('mentor', user.id)
        .eq('status', 'scheduled')
        .gte('scheduled_start', new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order('scheduled_start', { ascending: true });

      if (error) { console.error('Failed to load waiting room sessions', error); return; }
      const visibleSessions = (data ?? []).filter((session: any) => !blockedIds.has(session.mentee));
      if (visibleSessions.length === 0) { setSessions([]); return; }

      const menteeIds = [...new Set(visibleSessions.map((s: any) => s.mentee))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, photo_url')
        .in('id', menteeIds);

      const profileMap: Record<string, { name: string; photo: string | null }> = {};
      (profiles ?? []).forEach((p: any) => {
        profileMap[p.id] = { name: p.full_name ?? 'Mentee', photo: p.photo_url ?? null };
      });

      setSessions(
        visibleSessions.map((s: any) => ({
          requestId: s.id,
          menteeName: profileMap[s.mentee]?.name ?? 'Mentee',
          menteePhoto: profileMap[s.mentee]?.photo ?? null,
          scheduledStart: s.scheduled_start,
          videoLink: s.video_link ?? null,
          description: s.description ?? null,
        })),
      );
    } catch (err) {
      console.error('Failed to load waiting room sessions', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions]),
  );

  useEffect(() => {
    const channel = supabase
      .channel('mentor-waiting-room')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mentor_requests' },
        () => { loadSessions(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadSessions]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Video"
        highlight="Waiting Room"
        subtitle="Your upcoming mentorship video calls."
      />

      {sessions.length === 0 ? (
        <Text style={styles.emptyText}>No upcoming sessions.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {sessions.map((session) => {
            const startMs = new Date(session.scheduledStart).getTime();
            const diffMin = Math.round((startMs - now) / 60_000);
            const countdownText =
              diffMin <= 0 ? 'In progress'
              : diffMin < 60 ? `In ${diffMin} min`
              : diffMin < 1440 ? `In ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
              : new Date(session.scheduledStart).toLocaleDateString();

            return (
              <View key={session.requestId} style={[styles.card, { backgroundColor: theme.card }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    {session.menteePhoto ? (
                      <Image source={{ uri: session.menteePhoto }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {session.menteeName.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, font('GlacialIndifference', '800'), { color: theme.text }]}>
                      {session.menteeName}
                    </Text>
                    <Text style={styles.time}>
                      {new Date(session.scheduledStart).toLocaleDateString()} at{' '}
                      {new Date(session.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.countdown}>{countdownText}</Text>
                </View>

                {session.description ? (
                  <Text style={[styles.description, { color: theme.text }]} numberOfLines={2}>
                    {session.description}
                  </Text>
                ) : null}

                {diffMin <= 5 && diffMin >= -30 && session.videoLink ? (
                  <Pressable
                    style={styles.joinBtn}
                    onPress={() => {
                      router.push({
                        pathname: '/(app)/video-call' as any,
                        params: { roomUrl: session.videoLink!, requestId: String(session.requestId) },
                      });
                    }}
                  >
                    <Text style={styles.joinBtnText}>Join Call</Text>
                  </Pressable>
                ) : (
                  <View style={styles.waitingBadge}>
                    <Text style={styles.waitingBadgeText}>Waiting...</Text>
                  </View>
                )}

                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => {
                    Alert.alert(
                      'Cancel Session',
                      `Are you sure you want to cancel your session with ${session.menteeName}? Tokens will be refunded to the mentee.`,
                      [
                        { text: 'Keep Session', style: 'cancel' },
                        {
                          text: 'Cancel Session',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await cancelSession(session.requestId);
                              Alert.alert('Cancelled', 'The session has been cancelled and tokens have been refunded.');
                              loadSessions();
                            } catch (err: any) {
                              Alert.alert('Error', err.message ?? 'Failed to cancel session');
                            }
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel Session</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
  },
  emptyText: {
    fontSize: 14,
    color: '#8f8e8e',
    marginTop: 16,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  name: {
    fontSize: 16,
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
    color: '#777',
  },
  countdown: {
    fontSize: 12,
    color: '#968c6c',
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 8,
  },
  joinBtn: {
    backgroundColor: '#333f5c',
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 10,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  waitingBadge: {
    backgroundColor: '#edecf1',
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 10,
  },
  waitingBadgeText: {
    color: '#777',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#c43b3b',
  },
  cancelBtnText: {
    color: '#c43b3b',
    fontSize: 13,
    fontWeight: '600',
  },
});
