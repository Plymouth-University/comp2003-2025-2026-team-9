import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  findNodeHandle,
  FlatList,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/BackButton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import type { Profile } from '../../../src/lib/supabase';
import { getCurrentUser, supabase } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

type Message = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  deleted?: boolean;
  edited?: boolean;
};

type AppTheme = typeof Colors[keyof typeof Colors];

const CLOSED_BOTTOM_OFFSET = 70;
const GAP_ABOVE_KEYBOARD = 6;
const EXTRA_LIST_GAP = 16;
const SCROLL_DELAY = 80;
const NEAR_BOTTOM_THRESHOLD = 140;

export default function MenteeChatScreen() {
  const params = useLocalSearchParams<{ threadId?: string; otherId?: string; name?: string }>();
  const insets = useSafeAreaInsets();

  const threadId = params.threadId ? Number(params.threadId) : null;
  const otherId = typeof params.otherId === 'string' ? params.otherId : null;
  const fallbackName =
    typeof params.name === 'string' && params.name.length > 0 ? params.name : 'Peer';

  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [meId, setMeId] = useState<string | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(72);

  const [screenY, setScreenY] = useState(0);
  const [screenHeight, setScreenHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  const rootRef = useRef<View>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const isNearBottomRef = useRef(true);
  const pendingScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = otherProfile?.full_name ?? fallbackName;

  const measureRootInWindow = useCallback(() => {
    const node = findNodeHandle(rootRef.current);
    if (!node) return;

    UIManager.measureInWindow(node, (_x, y, _w, h) => {
      setScreenY(y);
      setScreenHeight(h);
    });
  }, []);

  const screenBottom = screenY + screenHeight;
  const keyboardVisible = keyboardTop !== null;

  const composerBottom = keyboardVisible
    ? Math.max(0, screenBottom - keyboardTop + GAP_ABOVE_KEYBOARD)
    : CLOSED_BOTTOM_OFFSET + Math.max(insets.bottom, 8);

  const listBottomSpacer = composerHeight + composerBottom + EXTRA_LIST_GAP;

  const clearPendingScroll = () => {
    if (pendingScrollTimeoutRef.current) {
      clearTimeout(pendingScrollTimeoutRef.current);
      pendingScrollTimeoutRef.current = null;
    }
  };

  const scrollToBottom = (animated = true, delay = 0, force = false) => {
    if (!force && !isNearBottomRef.current) return;

    clearPendingScroll();

    const run = () => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated });
      });
    };

    if (delay > 0) {
      pendingScrollTimeoutRef.current = setTimeout(() => {
        pendingScrollTimeoutRef.current = null;
        run();
      }, delay);
    } else {
      run();
    }
  };

  const formatMessage = (m: any, currentUserId: string): Message => {
    const deleted = !!m.deleted_at;
    const edited = !!m.edited_at;

    return {
      id: String(m.id),
      from: m.sender === currentUserId ? 'me' : 'them',
      text: deleted ? 'Message deleted' : m.body,
      time: new Date(m.inserted_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      deleted,
      edited,
    };
  };

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const load = async () => {
      if (!threadId) return;

      const me = await getCurrentUser();
      if (!isMounted) return;
      setMeId(me.id);

      if (otherId) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, title, industry, bio, photo_url, role')
          .eq('id', otherId)
          .single();

        if (!profileError && profile && isMounted) {
          setOtherProfile(profile as Profile);
        }
      }

      const { data, error } = await supabase
        .from('messages')
        .select('id, sender, body, inserted_at, edited_at, deleted_at')
        .eq('thread_id', threadId)
        .order('inserted_at', { ascending: true });

      if (error) {
        console.error('Failed to load messages', error);
        return;
      }

      if (!isMounted) return;

      const mapped: Message[] = (data ?? []).map((m) => formatMessage(m, me.id));
      setMessages(mapped);
      isNearBottomRef.current = true;
      scrollToBottom(false, SCROLL_DELAY, true);

      channel = supabase
        .channel(`messages-thread-${threadId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${threadId}`,
          },
          (payload) => {
            const row = payload.new as any;

            setMessages((prev) => {
              const idStr = String(row.id);
              if (prev.some((m) => m.id === idStr)) return prev;
              return [...prev, formatMessage(row, me.id)];
            });

            scrollToBottom(true, SCROLL_DELAY);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${threadId}`,
          },
          (payload) => {
            const row = payload.new as any;

            setMessages((prev) =>
              prev.map((m) => (m.id === String(row.id) ? formatMessage(row, me.id) : m))
            );

            scrollToBottom(true, SCROLL_DELAY);
          }
        )
        .subscribe();
    };

    load();

    return () => {
      isMounted = false;
      clearPendingScroll();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [threadId, otherId]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false, 40, true);
    }
  }, [messages.length, listBottomSpacer]);

  useEffect(() => {
    measureRootInWindow();
    const t = setTimeout(measureRootInWindow, 120);
    return () => clearTimeout(t);
  }, [measureRootInWindow]);

  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      const top = e?.endCoordinates?.screenY;
      if (typeof top === 'number') {
        setKeyboardTop(top);
      }
      setTimeout(() => {
        measureRootInWindow();
        scrollToBottom(false, 40, true);
      }, 20);
    };

    const handleKeyboardHide = () => {
      setKeyboardTop(null);
      setTimeout(() => {
        measureRootInWindow();
        scrollToBottom(false, 40, true);
      }, 20);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);

    let frameSub: { remove: () => void } | null = null;

    if (Platform.OS === 'ios') {
      frameSub = Keyboard.addListener('keyboardWillChangeFrame', (e: any) => {
        const top = e?.endCoordinates?.screenY;
        if (typeof top === 'number') {
          setKeyboardTop(top);
        }
        setTimeout(() => {
          measureRootInWindow();
          scrollToBottom(false, 40, true);
        }, 20);
      });
    }

    return () => {
      showSub.remove();
      hideSub.remove();
      frameSub?.remove();
    };
  }, [measureRootInWindow]);

  const handleSend = async () => {
    if (!threadId || !meId || !input.trim()) return;

    const body = input.trim();
    setInput('');
    isNearBottomRef.current = true;

    if (editingMessageId) {
      const { data, error } = await supabase
        .from('messages')
        .update({
          body,
          edited_at: new Date().toISOString(),
          deleted_at: null,
        })
        .eq('id', editingMessageId)
        .select('id, sender, body, inserted_at, edited_at, deleted_at')
        .single();

      if (error) {
        console.error('Failed to edit message', error);
        setInput(body);
        return;
      }

      setEditingMessageId(null);
      setMessages((prev) =>
        prev.map((m) => (m.id === String(data.id) ? formatMessage(data, meId) : m))
      );
      scrollToBottom(true, SCROLL_DELAY, true);
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        sender: meId,
        body,
      })
      .select('id, sender, body, inserted_at, edited_at, deleted_at')
      .single();

    if (error) {
      console.error('Failed to send message', error);
      setInput(body);
      return;
    }

    setMessages((prev) => [...prev, formatMessage(data, meId)]);
    scrollToBottom(true, SCROLL_DELAY, true);
  };

  const handleMessageLongPress = (message: Message) => {
    if (message.from !== 'me' || message.deleted) return;

    Alert.alert('Message options', undefined, [
      {
        text: 'Edit',
        onPress: () => {
          setInput(message.text);
          setEditingMessageId(message.id);
          isNearBottomRef.current = true;
          scrollToBottom(false, 40, true);
        },
      },
      {
        text: 'Unsend',
        style: 'destructive',
        onPress: async () => {
          if (!meId) return;

          try {
            const { data, error } = await supabase
              .from('messages')
              .update({
                body: '',
                deleted_at: new Date().toISOString(),
              })
              .eq('id', message.id)
              .select('id, sender, body, inserted_at, edited_at, deleted_at')
              .single();

            if (error) throw error;

            setMessages((prev) =>
              prev.map((m) => (m.id === String(data.id) ? formatMessage(data, meId) : m))
            );

            scrollToBottom(true, SCROLL_DELAY, true);
          } catch (err) {
            console.error('Failed to unsend message', err);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRootLayout = (_e: LayoutChangeEvent) => {
    measureRootInWindow();
    scrollToBottom(false, 30, true);
  };

  const handleInputContentSizeChange = (
    _e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
  ) => {
    scrollToBottom(false, 30, true);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
  };

  return (
    <View
      ref={rootRef}
      onLayout={handleRootLayout}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <BackButton />
          <TouchableOpacity
            style={styles.headerProfileBlock}
            activeOpacity={0.8}
            disabled={!otherId}
            onPress={() => {
              if (!otherId) return;
              router.push({
                pathname: '/(app)/Mentee/profile-view',
                params: { userId: otherId },
              });
            }}
          >
            <View style={styles.headerAvatar}>
              {otherProfile?.photo_url ? (
                <Image source={{ uri: otherProfile.photo_url }} style={styles.headerAvatarImage} />
              ) : (
                <Text style={styles.headerAvatarInitial}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>

            <View style={styles.headerTextBlock}>
              <Text
                style={[
                  styles.headerName,
                  font('GlacialIndifference', '800'),
                  { color: theme.text },
                ]}
              >
                {displayName}
              </Text>
              <Text style={[styles.headerSubtitle, font('GlacialIndifference', '400')]}>
                Peer match conversation
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onLayout={() => {
            scrollToBottom(false, 50, true);
          }}
          onContentSizeChange={() => {
            scrollToBottom(false, 20, true);
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: listBottomSpacer }} />}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              theme={theme}
              onLongPress={handleMessageLongPress}
            />
          )}
        />

        <View
          onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
          style={[
            styles.composerWrap,
            {
              bottom: composerBottom,
            },
          ]}
        >
          <View style={[styles.composer, { backgroundColor: theme.card }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder={editingMessageId ? 'Edit message...' : 'Message...'}
              placeholderTextColor="#7f8186"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              returnKeyType="default"
              textAlignVertical="top"
              onFocus={() => {
                isNearBottomRef.current = true;
                measureRootInWindow();
                scrollToBottom(false, 80, true);
              }}
              onContentSizeChange={handleInputContentSizeChange}
            />

            <TouchableOpacity
              style={[styles.sendButton, { opacity: input.trim() ? 1 : 0.5 }]}
              activeOpacity={0.8}
              onPress={handleSend}
              disabled={!input.trim()}
            >
              <Text style={styles.sendButtonText}>
                {editingMessageId ? 'Save' : 'Send'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

type MessageBubbleProps = {
  message: Message;
  theme: AppTheme;
  onLongPress?: (message: Message) => void;
};

function MessageBubble({ message, theme, onLongPress }: MessageBubbleProps) {
  const isMe = message.from === 'me';
  const timeColor = isMe ? 'rgba(255,255,255,0.72)' : '#8a8f98';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={() => onLongPress?.(message)}
      style={[
        styles.bubbleRow,
        {
          justifyContent: isMe ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMe ? styles.bubbleMe : [styles.bubbleThem, { backgroundColor: theme.card }],
          message.deleted && styles.deletedBubble,
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            {
              color: message.deleted ? '#8a8f98' : isMe ? '#fff' : theme.text,
              fontStyle: message.deleted ? 'italic' : 'normal',
            },
          ]}
        >
          {message.text}
        </Text>

        <View style={styles.metaRow}>
          {message.edited && !message.deleted ? (
            <Text style={[styles.editedText, { color: timeColor }]}>Edited</Text>
          ) : null}
          <Text style={[styles.bubbleTime, { color: timeColor }]}>{message.time}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  container: {
    ...commonStyles.screen,
    flex: 1,
    paddingHorizontal: 18,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  headerProfileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    flex: 1,
  },

  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },

  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },

  headerAvatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  headerTextBlock: {
    flex: 1,
  },

  headerName: {
    fontSize: 18,
  },

  headerSubtitle: {
    fontSize: 12,
    color: '#8f8e8e',
    marginTop: 2,
  },

  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 8,
  },

  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },

  bubbleMe: {
    backgroundColor: '#333f5c',
    borderBottomRightRadius: 4,
  },

  bubbleThem: {
    borderBottomLeftRadius: 4,
  },

  deletedBubble: {
    opacity: 0.75,
  },

  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },

  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  editedText: {
    fontSize: 10,
    marginRight: 6,
  },

  bubbleTime: {
    fontSize: 10,
  },

  composerWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    backgroundColor: 'transparent',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
    maxHeight: 120,
  },

  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#968c6c',
    alignSelf: 'flex-end',
  },

  sendButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});