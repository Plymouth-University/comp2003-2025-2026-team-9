import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import { acceptSession, declineSession } from '../../../src/lib/sessions';
import { commonStyles } from '../../../src/styles/common';
import { supabase } from '../../../src/lib/supabase';

type MentorChatItem = {
  requestId: number;
  threadId: number;
  otherUserId: string;
  name: string;
  photoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  status: string;
  description: string | null;
  scheduledStart: string | null;
};

export default function MentorConnectionsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [chats, setChats] = useState<MentorChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let channel: any | null = null;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setChats([]);
          return;
        }

        // 1) All mentor_requests for this mentor that have an associated thread
        const { data: requests, error: reqError } = await supabase
          .from('mentor_requests')
          .select('id, mentee, mentor, thread_id, proposed_at, status, description, scheduled_start')
          .eq('mentor', user.id)
          .not('thread_id', 'is', null)
          .not('status', 'eq', 'cancelled')
          .order('proposed_at', { ascending: false });

        if (reqError) throw reqError;

        if (!requests || requests.length === 0) {
          if (!isMounted) return;
          setChats([]);
          return;
        }

        const menteeIds = Array.from(new Set(requests.map((r: any) => r.mentee)));

        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, photo_url')
          .in('id', menteeIds);

        if (profileError) throw profileError;

        const profileMap: Record<string, { name: string; photoUrl: string | null }> = {};
        (profiles ?? []).forEach((p: any) => {
          profileMap[p.id] = {
            name: p.full_name ?? 'Mentee',
            photoUrl: p.photo_url ?? null,
          };
        });

        const threadIds = Array.from(
          new Set(requests.map((r: any) => r.thread_id).filter((id: number | null): id is number => id != null)),
        );

        let lastByThread: Record<number, { body: string; inserted_at: string }> = {};
        if (threadIds.length > 0) {
          const { data: msgs, error: msgError } = await supabase
            .from('messages')
            .select('id, thread_id, body, inserted_at')
            .in('thread_id', threadIds)
            .order('inserted_at', { ascending: false });

          if (msgError) throw msgError;

          (msgs ?? []).forEach((m: any) => {
            if (!lastByThread[m.thread_id]) {
              lastByThread[m.thread_id] = {
                body: m.body,
                inserted_at: m.inserted_at,
              };
            }
          });
        }

        const chatItems: MentorChatItem[] = (requests ?? []).map((r: any) => {
          const profile = profileMap[r.mentee] ?? { name: 'Mentee', photoUrl: null };
          const last = r.thread_id ? lastByThread[r.thread_id] : undefined;
          return {
            requestId: r.id,
            threadId: r.thread_id!,
            otherUserId: r.mentee,
            name: profile.name,
            photoUrl: profile.photoUrl,
            lastMessage: last?.body ?? null,
            lastMessageAt: last?.inserted_at ?? null,
            status: r.status ?? 'requested',
            description: r.description ?? null,
            scheduledStart: r.scheduled_start ?? null,
          };
        }).sort((a, b) => {
          // Show pending requests first, then sort by most recent message
          if (a.status === 'requested' && b.status !== 'requested') return -1;
          if (b.status === 'requested' && a.status !== 'requested') return 1;
          const ta = a.lastMessageAt ?? '';
          const tb = b.lastMessageAt ?? '';
          return ta < tb ? 1 : ta > tb ? -1 : 0;
        });

        if (!isMounted) return;
        setChats(chatItems);
      } catch (err: any) {
        console.error('Failed to load mentor connections', err);
        if (!isMounted) return;
        setError(err.message ?? 'Failed to load connections');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const setupRealtime = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        channel = supabase
          .channel(`mentor-connections-${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'mentor_requests' },
            () => {
              if (isMounted) {
                load();
              }
            },
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            () => {
              if (isMounted) {
                load();
              }
            },
          )
          .subscribe();
      } catch (err) {
        console.warn('Failed to set up realtime for mentor connections', err);
      }
    };

    load();
    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const openChat = (item: MentorChatItem) => {
    router.push({
      pathname: '/(app)/Mentor/chat',
      params: {
        threadId: String(item.threadId),
        otherId: item.otherUserId,
        name: item.name,
      },
    });
  };

  const handleAccept = async (item: MentorChatItem) => {
    try {
      await acceptSession(item.requestId);
      Alert.alert('Accepted', `Session with ${item.name} has been confirmed.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to accept request');
    }
  };

  const handleDecline = async (item: MentorChatItem) => {
    Alert.alert(
      'Decline Request',
      `Decline session request from ${item.name}? Their tokens will be refunded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineSession(item.requestId);
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to decline request');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Connections"
        subtitle="Mentees who have booked sessions with you."
      />

      {loading && (
        <View style={{ paddingVertical: 16 }}>
          <ActivityIndicator />
        </View>
      )}

      {error && (
        <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
      )}

      {chats.length === 0 && !loading ? (
        <Text style={{ fontSize: 14, color: '#8f8e8e' }}>
          No active mentee chats yet.
        </Text>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => String(item.threadId)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            item.status === 'requested' ? (
              <View style={[styles.requestCard, { backgroundColor: theme.card }]}>
                <View style={styles.requestHeader}>
                  <View style={styles.avatar}>
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {item.name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, font('GlacialIndifference', '800'), { color: theme.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.requestBadge, font('GlacialIndifference', '400')]}>
                      New session request
                    </Text>
                  </View>
                </View>
                {item.description ? (
                  <Text style={[styles.requestDescription, { color: theme.text }]} numberOfLines={3}>
                    {item.description}
                  </Text>
                ) : null}
                {item.scheduledStart ? (
                  <Text style={styles.requestTime}>
                    {new Date(item.scheduledStart).toLocaleDateString()} at{' '}
                    {new Date(item.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                ) : null}
                <View style={styles.requestButtons}>
                  <TouchableOpacity
                    style={[styles.requestBtn, styles.requestBtnDecline]}
                    onPress={() => handleDecline(item)}
                  >
                    <Text style={styles.requestBtnDeclineText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.requestBtn, styles.requestBtnAccept]}
                    onPress={() => handleAccept(item)}
                  >
                    <Text style={styles.requestBtnAcceptText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ConversationRow
                name={item.name}
                role="Mentee"
                lastMessage={item.lastMessage ?? 'New mentorship request'}
                time={item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleTimeString() : ''}
                photoUrl={item.photoUrl}
                unread={false}
                theme={theme}
                onPress={() => openChat(item)}
              />
            )
          )}
        />
      )}
    </View>
  );
}

type ConversationRowProps = {
  name: string;
  role: string;
  lastMessage: string;
  time: string;
  photoUrl?: string | null;
  unread?: boolean;
  theme: (typeof Colors)[keyof typeof Colors];
  onPress?: () => void;
};

function ConversationRow({ name, role, lastMessage, time, photoUrl, unread, theme, onPress }: ConversationRowProps) {
  const initials = name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.row, { backgroundColor: theme.card }]}> 
        {/* Avatar */}
        <View style={styles.avatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>

      {/* Main text */}
      <View style={styles.rowMiddle}>
        <Text style={[styles.name, font('GlacialIndifference', '800'), { color: theme.text }]}>
          {name}
        </Text>
        <Text style={[styles.role, font('GlacialIndifference', '400')]}> 
          {role}
        </Text>
        <Text
          style={[styles.lastMessage, font('GlacialIndifference', '400')]}
          numberOfLines={1}
        >
          {lastMessage}
        </Text>
      </View>

      {/* Meta (time + unread dot) */}
      <View style={styles.rowRight}>
        <Text style={[styles.time, font('GlacialIndifference', '400')]}> 
          {time}
        </Text>
        {unread && <View style={styles.unreadDot} />}
      </View>
    </View>
  </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
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
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  rowMiddle: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    marginBottom: 2,
  },
  role: {
    fontSize: 12,
    color: '#8f8e8e',
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 13,
    color: '#666',
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40,
  },
  time: {
    fontSize: 11,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#968c6c',
    marginTop: 6,
  },
  // ── Pending request card styles ──
  requestCard: {
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#968c6c',
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestBadge: {
    fontSize: 12,
    color: '#968c6c',
    fontWeight: '600',
  },
  requestDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  requestTime: {
    fontSize: 12,
    color: '#777',
    marginBottom: 10,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  requestBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  requestBtnDecline: {
    borderWidth: 1,
    borderColor: '#c43b3b',
    backgroundColor: 'transparent',
  },
  requestBtnDeclineText: {
    color: '#c43b3b',
    fontSize: 13,
    fontWeight: '600',
  },
  requestBtnAccept: {
    backgroundColor: '#333f5c',
  },
  requestBtnAcceptText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
