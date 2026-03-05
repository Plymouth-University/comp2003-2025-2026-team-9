import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import { acceptSession, declineSession } from '../../../src/lib/sessions';
import { supabase } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

type PendingRequest = {
  requestId: number;
  menteeName: string;
  menteePhoto: string | null;
  scheduledStart: string;
  description: string | null;
};

type MentorChatItem = {
  requestId: number;
  threadId: number;
  otherUserId: string;
  name: string;
  photoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
};

export default function MentorConnectionsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [chats, setChats] = useState<MentorChatItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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

        // 0) Fetch pending requests (status = 'requested')
        const { data: pending, error: pendErr } = await supabase
          .from('mentor_requests')
          .select('id, mentee, scheduled_start, description')
          .eq('mentor', user.id)
          .eq('status', 'requested')
          .order('scheduled_start', { ascending: true });

        if (!pendErr && pending && pending.length > 0) {
          const pendMenteeIds = Array.from(new Set(pending.map((r: any) => r.mentee)));
          const { data: pendProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, photo_url')
            .in('id', pendMenteeIds);

          const pendMap: Record<string, { name: string; photo: string | null }> = {};
          (pendProfiles ?? []).forEach((p: any) => {
            pendMap[p.id] = { name: p.full_name ?? 'Mentee', photo: p.photo_url ?? null };
          });

          if (isMounted) {
            setPendingRequests(pending.map((r: any) => ({
              requestId: r.id,
              menteeName: pendMap[r.mentee]?.name ?? 'Mentee',
              menteePhoto: pendMap[r.mentee]?.photo ?? null,
              scheduledStart: r.scheduled_start,
              description: r.description ?? null,
            })));
          }
        } else if (isMounted) {
          setPendingRequests([]);
        }

        // 1) All mentor_requests for this mentor that have an associated thread
        const { data: requests, error: reqError } = await supabase
          .from('mentor_requests')
          .select('id, mentee, mentor, thread_id, proposed_at')
          .eq('mentor', user.id)
          .not('thread_id', 'is', null)
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
          };
        }).sort((a, b) => {
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

  const handleAccept = async (requestId: number) => {
    setActionLoading(requestId);
    try {
      await acceptSession(requestId);
      Alert.alert('Accepted', 'Session accepted. A video room has been created.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to accept request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (requestId: number) => {
    setActionLoading(requestId);
    try {
      await declineSession(requestId);
      Alert.alert('Declined', 'The request has been declined.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to decline request');
    } finally {
      setActionLoading(null);
    }
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

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <ThemedText style={[styles.sectionTitle, font('GlacialIndifference', '800')]}>Pending Requests</ThemedText>
            {pendingRequests.map((req) => {
              const isActing = actionLoading === req.requestId;
              return (
                <View key={req.requestId} style={[styles.requestCard, { backgroundColor: theme.card }]}>
                  <View style={styles.requestHeader}>
                    <View style={styles.avatar}>
                      {req.menteePhoto ? (
                        <Image source={{ uri: req.menteePhoto }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarText}>{req.menteeName.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, font('GlacialIndifference', '800'), { color: theme.text }]}>
                        {req.menteeName}
                      </Text>
                      <Text style={styles.requestTime}>
                        {new Date(req.scheduledStart).toLocaleDateString()} at{' '}
                        {new Date(req.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  {req.description ? (
                    <Text style={[styles.requestDesc, { color: theme.text }]} numberOfLines={3}>{req.description}</Text>
                  ) : null}
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.acceptBtn, isActing && { opacity: 0.5 }]}
                      onPress={() => handleAccept(req.requestId)}
                      disabled={isActing}
                    >
                      <Text style={styles.acceptBtnText}>{isActing ? '...' : 'Accept'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.declineBtn, isActing && { opacity: 0.5 }]}
                      onPress={() => handleDecline(req.requestId)}
                      disabled={isActing}
                    >
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Chats */}
        <ThemedText style={[styles.sectionTitle, font('GlacialIndifference', '800')]}>Chats</ThemedText>
        {chats.length === 0 && !loading ? (
          <Text style={{ fontSize: 14, color: '#8f8e8e' }}>
            No active mentee chats yet.
          </Text>
        ) : (
          chats.map((item) => (
            <View key={String(item.threadId)} style={{ marginBottom: 10 }}>
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
            </View>
          ))
        )}
      </ScrollView>
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
    paddingBottom: 0,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 140,
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
  sectionTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  requestCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestTime: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  requestDesc: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 8,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#333f5c',
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: '#edecf1',
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  declineBtnText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '600',
  },
});
