import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import { supabase } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

type MatchItem = {
  matchId: number;
  otherUserId: string;
  name: string;
  photoUrl: string | null;
  createdAt: string;
  threadId: number | null;
};

type ChatItem = {
  threadId: number;
  otherUserId: string;
  name: string;
  photoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
};

export default function MenteeConnectionsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
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
          setMatches([]);
          setChats([]);
          return;
        }

        // 1) Fetch all peer matches where this user is a participant
        const { data: matchRows, error: matchError } = await supabase
          .from('peer_matches')
          .select('id, member_a, member_b, thread_id, created_at')
          .or(`member_a.eq.${user.id},member_b.eq.${user.id}`)
          .order('created_at', { ascending: false });

        if (matchError) throw matchError;

        if (!matchRows || matchRows.length === 0) {
          if (!isMounted) return;
          setMatches([]);
          setChats([]);
          return;
        }

        // Determine the other user in each match
        const enrichedMatches: MatchItem[] = matchRows.map((m: any) => {
          const otherUserId = m.member_a === user.id ? m.member_b : m.member_a;
          return {
            matchId: m.id,
            otherUserId,
            name: '',
            photoUrl: null,
            createdAt: m.created_at,
            threadId: m.thread_id,
          };
        });

        const otherUserIds = Array.from(new Set(enrichedMatches.map((m) => m.otherUserId)));

        // 2) Fetch profiles for those users
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, photo_url')
          .in('id', otherUserIds);

        if (profileError) throw profileError;

        const nameById: Record<string, { name: string; photoUrl: string | null }> = {};
        (profiles ?? []).forEach((p: any) => {
          nameById[p.id] = {
            name: p.full_name ?? 'Member',
            photoUrl: p.photo_url ?? null,
          };
        });

        const matchesWithProfile: MatchItem[] = enrichedMatches.map((m) => ({
          ...m,
          name: nameById[m.otherUserId]?.name ?? 'Member',
          photoUrl: nameById[m.otherUserId]?.photoUrl ?? null,
        }));

        // 3) For chats, only include matches that already have a thread_id
        const threadIds = matchesWithProfile
          .map((m) => m.threadId)
          .filter((id): id is number => id != null);

        let chatsResult: ChatItem[] = [];

        if (threadIds.length > 0) {
          const { data: msgs, error: msgError } = await supabase
            .from('messages')
            .select('id, thread_id, sender, body, inserted_at')
            .in('thread_id', threadIds)
            .order('inserted_at', { ascending: false });

          if (msgError) throw msgError;

          const lastByThread: Record<number, { body: string; inserted_at: string }> = {};
          (msgs ?? []).forEach((m: any) => {
            if (!lastByThread[m.thread_id]) {
              lastByThread[m.thread_id] = {
                body: m.body,
                inserted_at: m.inserted_at,
              };
            }
          });

          chatsResult = matchesWithProfile
            .filter((m) => m.threadId != null)
            .map((m) => {
              const last = m.threadId ? lastByThread[m.threadId] : undefined;
              return {
                threadId: m.threadId!,
                otherUserId: m.otherUserId,
                name: m.name,
                photoUrl: m.photoUrl,
                lastMessage: last?.body ?? null,
                lastMessageAt: last?.inserted_at ?? null,
              };
            })
            .sort((a, b) => {
              const ta = a.lastMessageAt ?? '';
              const tb = b.lastMessageAt ?? '';
              return ta < tb ? 1 : ta > tb ? -1 : 0;
            });
        }

        if (!isMounted) return;
        setMatches(matchesWithProfile);
        setChats(chatsResult);
      } catch (err: any) {
        console.error('Failed to load mentee connections', err);
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
          .channel(`mentee-connections-${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'peer_matches' },
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
        console.warn('Failed to set up realtime for mentee connections', err);
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

  const openChat = async (item: MatchItem | ChatItem) => {
    try {
      // If we already have a threadId, just navigate
      if ('threadId' in item && item.threadId) {
        router.push({
          pathname: '/(app)/Mentee/chat',
          params: {
            threadId: String(item.threadId),
            otherId: item.otherUserId,
            name: item.name,
          },
        });
        return;
      }

      // Otherwise, ask the backend RPC to create/ensure a peer thread
      const { data, error } = await supabase.rpc('ensure_peer_thread', {
        other_user: item.otherUserId,
      });
      if (error) throw error;

      const threadId = data?.id as number | undefined;
      if (!threadId) return;

      router.push({
        pathname: '/(app)/Mentee/chat',
        params: {
          threadId: String(threadId),
          otherId: item.otherUserId,
          name: item.name,
        },
      });
    } catch (err) {
      console.error('Failed to open chat', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Connections"
        subtitle="Your peer connections and active chats."
      />

      {loading && (
        <View style={{ paddingVertical: 16 }}>
          <ActivityIndicator />
        </View>
      )}

      {error && (
        <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>
      )}

      {/* Matches strip */}
      <View style={styles.matchesSection}>
        <ThemedText style={[styles.matchesTitle, font('GlacialIndifference', '800')]}>Matches</ThemedText>
        {matches.length === 0 ? (
          <Text style={styles.emptyText}>No connections yet – keep swiping in Discovery.</Text>
        ) : (
          <FlatList
            horizontal
            data={matches}
            keyExtractor={(m) => String(m.matchId)}
            contentContainerStyle={{ paddingVertical: 8 }}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => openChat(item)}
                style={[styles.matchCard, { backgroundColor: theme.card }]}
              >
                <View style={styles.matchAvatar}>
                  {item.photoUrl ? (
                    <Image
                      source={{ uri: item.photoUrl }}
                      style={styles.matchAvatarImage}
                    />
                  ) : (
                    <Text style={styles.matchAvatarInitial}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text
                  style={[styles.matchName, font('GlacialIndifference', '800'), { color: theme.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Chats list */}
      <FlatList
        data={chats}
        keyExtractor={(item) => String(item.threadId)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ThemedText style={[styles.chatsTitle, font('GlacialIndifference', '800')]}>Chats</ThemedText>
        }
        renderItem={({ item }) => (
          <ConversationRow
            name={item.name}
            role="Peer match"
            lastMessage={item.lastMessage ?? 'Say hi and start the conversation!'}
            time={item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleTimeString() : ''}
            photoUrl={item.photoUrl}
            unread={false}
            theme={theme}
            onPress={() => openChat(item)}
          />
        )}
      />
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
  matchesSection: {
    marginBottom: 16,
  },
  matchesTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  chatsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#8f8e8e',
    marginTop: 8,
  },
  matchCard: {
    width: 96,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 16,
  },
  matchAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  matchAvatarInitial: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  matchAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  matchName: {
    fontSize: 12,
    textAlign: 'center',
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
});
