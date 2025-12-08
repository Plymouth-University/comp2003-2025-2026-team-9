import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

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

export type Profile = {
  id: string;
  full_name: string | null;
  title: string | null;
  industry: string | null;
  bio: string | null;
  photo_url: string | null;
  role: 'member' | 'mentor' | 'admin' | null;
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

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user;
}

export async function fetchDiscoveryProfiles(): Promise<Profile[]> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, title, industry, bio, photo_url, role')
    .neq('id', user.id)   // don’t show myself
    .eq('role', 'member') // only show mentee/member profiles in discovery
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Profile[];
}


export async function swipeOnProfile(
  swipedId: string,
  direction: 'like' | 'pass',
  comment?: string
) {
  const user = await getCurrentUser();

  const { error } = await supabase.from('peer_swipes').insert({
    swiper: user.id,
    swiped: swipedId,
    direction,
    comment: comment ?? null,
  });

  if (error) throw error;
}

export async function rpcCreateMatchOnMutualHandshake(otherUserId: string) {
  const { data, error } = await supabase.rpc('create_match_on_mutual_handshake', {
    other_user: otherUserId, // must match SQL param name
  });
  if (error) throw error;
  return data; // either a peer_matches row or null
}

// Simple like (no message)
export async function likeProfile(otherUserId: string) {
  await swipeOnProfile(otherUserId, 'like');
  await rpcCreateMatchOnMutualHandshake(otherUserId);
}

// Like + first message
export async function likeProfileWithMessage(otherUserId: string, message: string) {
  await swipeOnProfile(otherUserId, 'like', message);
  await rpcCreateMatchOnMutualHandshake(otherUserId);
}

// Reply to an incoming handshake (also a like)
export async function replyToHandshake(fromUserId: string, replyMessage: string) {
  await swipeOnProfile(fromUserId, 'like', replyMessage);
  const match = await rpcCreateMatchOnMutualHandshake(fromUserId);
  return match; // can be null or a peer_matches row
}

// Upload a local image file as this user's profile photo.
// fileUri is something like "file:///..." from expo-image-picker.
export async function uploadProfilePhoto(fileUri: string): Promise<string> {
  const user = await getCurrentUser();

  // Guess extension, default to jpg
  const ext = fileUri.split('.').pop()?.toLowerCase();
  const fileExt = ext === 'png' ? 'png' : 'jpg';
  const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

  const filePath = `profiles/${user.id}.${fileExt}`;

  // 1) Read the picked image as base64 from the local file system
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: 'base64',
  });

  // 2) Convert base64 → ArrayBuffer (what Supabase storage expects)
  const arrayBuffer = decode(base64);

  // 3) Upload to the `avatars` bucket in Supabase
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

  // 4) Get a public URL for the uploaded file
  const { data: publicData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  const publicUrl = publicData.publicUrl;

  // 5) Store that URL in the user's profile row
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
