import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
