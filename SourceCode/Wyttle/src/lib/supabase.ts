import { createClient } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import 'react-native-url-polyfill/auto';
import { notifyDiscoveryShouldRefresh } from './discovery-refresh';

// Avoid referencing `window` (and AsyncStorage's web shim) during SSR
const isServer = typeof window === 'undefined';

// Minimal no-op storage for SSR to prevent "window is not defined"
type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const serverStorage: StorageAdapter = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

// On the client (native/web), use AsyncStorage; on the server, use a no-op storage
const storage = isServer ? serverStorage : require('@react-native-async-storage/async-storage').default;

const { supabaseUrl, supabaseAnonKey } = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl: string; supabaseAnonKey: string;
};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase config is missing from Expo config extra.');
}

export type Profile = {
  id: string;
  full_name: string | null;
  title: string | null;      // career / role title
  industry: string | null;
  bio: string | null;
  erience: string | null;
  photo_url: string | null;
  role: 'member' | 'mentor' | 'admin' | null;
  approval_status?: 'pending' | 'approved' | 'rejected' | null;
  account_type?: boolean | null; // 0 = normal user, 1 = admin (stored as boolean in profiles)
  location?: string | null;  // optional location field
  skills?: string[] | null;
  interests?: string[] | null;
  looking_for?: string | string[] | null;
  distance_miles?: number | null;
  tokens_balance?: number | null;
  mentor_session_rate?: number | null;
};

export async function getLastPassSwipeId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_last_pass_swipe');
  if (error) throw error;
  return data ?? null;
}

export async function undoLastPassSwipeStack(): Promise<string | null> {
  const { data, error } = await supabase.rpc('undo_last_pass_swipe_stack');
  if (error) throw error;
  return data ?? null;
}

export type BlockStatus = {
  blockedByMe: boolean;
  blockedByThem: boolean;
  isBlocked: boolean;
};

export type BlockedUserProfile = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Listen for auth state changes so we can handle token refresh failures
// and redirect the user back to the sign-in screen with an informative
// flag so UI can show a friendly toast.
if (!isServer) {
  // Use require to avoid importing router during SSR
  const { router } = require('expo-router');

  supabase.auth.onAuthStateChange((event) => {
    try {
      const ev = String(event || '').toLowerCase();

      if (ev.includes('refresh') && (ev.includes('fail') || ev.includes('failed'))) {
        // best-effort sign out (ignore errors)
        supabase.auth.signOut().catch(() => {});

        // Show a global toast if available (use require to avoid SSR import issues)
        try {
          const { showToast } = require('./toast');
          showToast('Session expired. Please sign in again.', 'error', 5000);
        } catch (err) {
          // ignore if toast system is not ready
        }

        // keep the router replace as a fallback to ensure user lands on sign-in
        try {
          router.replace('/(auth)/sign-in?from=logout&expired=1');
        } catch (err) {
          // swallow any router errors during background handling
        }
      }
    } catch (err) {
      // swallow errors to avoid crashing the app from an auth hook
    }
  });
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user;
}

export async function fetchDiscoveryProfiles(maxDistanceMiles: number | null = null): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('discover_profiles', {
    p_max_distance_miles: maxDistanceMiles == null ? null : Math.round(maxDistanceMiles),
    p_limit: 100,
  });

  if (error) throw error;
  const profiles = (data ?? []) as Profile[];
  const blockedIds = new Set(await fetchBlockedUserIds());
  return profiles.filter((profile) => !blockedIds.has(profile.id));
}


export async function swipeOnProfile(
  swipedId: string,
  direction: 'like' | 'pass',
  comment?: string
) {
  const user = await getCurrentUser();

  if (direction === 'pass') {
    const { error } = await supabase.rpc('record_discovery_pass', {
      p_swiped: swipedId,
      p_comment: comment ?? null,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('peer_swipes').insert({
    swiper: user.id,
    swiped: swipedId,
    direction,
    comment: comment ?? null,
  });

  if (error) throw error;
}

export async function undoLastPassSwipe(swipedId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('undo_last_pass_swipe', {
    p_swiped_id: swipedId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function blockUser(blockedId: string) {
  const me = await getCurrentUser();
  if (me.id === blockedId) throw new Error('You cannot block yourself');

  const { error } = await supabase
    .from('user_blocks')
    .upsert(
      {
        blocker: me.id,
        blocked: blockedId,
      },
      {
        onConflict: 'blocker,blocked',
        ignoreDuplicates: true,
      },
    );
  if (error) throw error;

  await supabase
    .from('peer_swipes')
    .delete()
    .or(
      `and(swiper.eq.${me.id},swiped.eq.${blockedId}),` +
        `and(swiper.eq.${blockedId},swiped.eq.${me.id})`,
    );

  await disconnectPeer(blockedId).catch((disconnectError) => {
    console.warn('Failed to disconnect blocked peer', disconnectError);
  });

  notifyDiscoveryShouldRefresh();
  return true;
}

export async function unblockUser(blockedId: string) {
  const me = await getCurrentUser();

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker', me.id)
    .eq('blocked', blockedId);

  if (error) throw error;

  await supabase
    .from('peer_swipes')
    .delete()
    .or(
      `and(swiper.eq.${me.id},swiped.eq.${blockedId}),` +
        `and(swiper.eq.${blockedId},swiped.eq.${me.id})`,
    );

  notifyDiscoveryShouldRefresh();
  return true;
}

export async function fetchBlockedUserIds(): Promise<string[]> {
  const me = await getCurrentUser();

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker, blocked')
    .or(`blocker.eq.${me.id},blocked.eq.${me.id}`);

  if (error) throw error;

  const ids = new Set<string>();
  (data ?? []).forEach((row: { blocker: string; blocked: string }) => {
    ids.add(row.blocker === me.id ? row.blocked : row.blocker);
  });

  return [...ids];
}

export async function getBlockStatus(otherUserId: string): Promise<BlockStatus> {
  const me = await getCurrentUser();

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker, blocked')
    .or(
      `and(blocker.eq.${me.id},blocked.eq.${otherUserId}),` +
        `and(blocker.eq.${otherUserId},blocked.eq.${me.id})`,
    );

  if (error) throw error;

  const blockedByMe = (data ?? []).some(
    (row: { blocker: string; blocked: string }) => row.blocker === me.id && row.blocked === otherUserId,
  );
  const blockedByThem = (data ?? []).some(
    (row: { blocker: string; blocked: string }) => row.blocker === otherUserId && row.blocked === me.id,
  );

  return {
    blockedByMe,
    blockedByThem,
    isBlocked: blockedByMe || blockedByThem,
  };
}

export async function fetchMyBlockedUsers(): Promise<BlockedUserProfile[]> {
  const me = await getCurrentUser();

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked')
    .eq('blocker', me.id);

  if (error) throw error;

  const blockedIds = (data ?? []).map((row: { blocked: string }) => row.blocked);
  if (blockedIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, photo_url')
    .in('id', blockedIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map(
    ((profiles ?? []) as BlockedUserProfile[]).map((profile) => [profile.id, profile]),
  );

  return blockedIds
    .map((id) => profileMap.get(id))
    .filter((profile): profile is BlockedUserProfile => Boolean(profile));
}

export async function rpcCreateMatchOnMutualHandshake(otherUserId: string) {
  const { data, error } = await supabase.rpc('create_match_on_mutual_handshake', {
    other_user: otherUserId, // must match SQL param name
  });
  if (error) throw error;
  return data; // either a peer_matches row or null
}

// Simple like (no message). Returns peer_matches row if a mutual match was created.
export async function likeProfile(otherUserId: string) {
  await swipeOnProfile(otherUserId, 'like');
  const match = await rpcCreateMatchOnMutualHandshake(otherUserId);
  return match;
}

// Like + first message. Returns peer_matches row if a mutual match was created.
export async function likeProfileWithMessage(otherUserId: string, message: string) {
  await swipeOnProfile(otherUserId, 'like', message);
  const match = await rpcCreateMatchOnMutualHandshake(otherUserId);
  return match;
}

// Reply to an incoming handshake (also a like)
export async function replyToHandshake(fromUserId: string, replyMessage: string) {
  await swipeOnProfile(fromUserId, 'like', replyMessage);
  const match = await rpcCreateMatchOnMutualHandshake(fromUserId);
  return match; // can be null or a peer_matches row
}

// Disconnect / unmatch from a peer. This deletes the peer_matches row between the
// current user and the other user (in either member_a/member_b order).
export async function disconnectPeer(otherUserId: string) {
  const me = await getCurrentUser();

  const { error } = await supabase
    .from('peer_matches')
    .delete()
    .or(
      `and(member_a.eq.${me.id},member_b.eq.${otherUserId}),` +
        `and(member_a.eq.${otherUserId},member_b.eq.${me.id})`,
    );

  if (error) throw error;
}

export async function deleteMyAccount() {
  const { data, error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  return data;
}

// Upload a local image file as this user's profile photo.
// fileUri is something like "file:///..." from expo-image-picker.
export async function uploadProfilePhoto(fileUri: string): Promise<string> {
  const user = await getCurrentUser();

  // Compress and resize before upload (max 800x800, JPEG at 0.7 quality)
  const compressed = await ImageManipulator.manipulateAsync(
    fileUri,
    [{ resize: { width: 800, height: 800 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  const processedUri = compressed.uri;

  const filePath = `profiles/${user.id}.jpg`;
  const contentType = 'image/jpeg';

  // Read the file as base64 using expo-file-system
  const base64 = await FileSystem.readAsStringAsync(processedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Convert base64 to ArrayBuffer
  const arrayBuffer = decode(base64);

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, {
      upsert: true,
      contentType,
    });

  if (uploadError) {
    console.log('Avatar upload error:', uploadError);
    throw uploadError;
  }

  // Get a public URL for the uploaded file
  const { data: publicData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // Append a cache-busting query string so React Native refetches updated avatars
  const publicUrl = `${publicData.publicUrl}?v=${Date.now()}`;

  // Store that URL in the user's profile row
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ photo_url: publicUrl })
    .eq('id', user.id);

  if (profileError) {
    console.log('Profile update error:', profileError);
    throw profileError;
  }

  return publicUrl;
}
