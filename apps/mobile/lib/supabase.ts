import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import Constants from "expo-constants";

import type { Database } from "@prostcounter/db";

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ||
  (typeof process !== "undefined"
    ? process.env.EXPO_PUBLIC_SUPABASE_URL
    : "") ||
  "";
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  (typeof process !== "undefined"
    ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    : "") ||
  "";

// Lazily create the Supabase client to avoid SSR issues
let _supabase: SupabaseClient<Database> | null = null;

function getSupabaseClient(): SupabaseClient<Database> {
  if (_supabase) return _supabase;

  // For web SSR, use a minimal client without persistence
  const isServer = typeof window === "undefined";

  if (isServer) {
    _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } else {
    // Client-side: use AsyncStorage for persistence
    // Dynamic import to avoid SSR issues
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;

    _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    // Auto-refresh token when app becomes active (native only)
    if (Platform.OS !== "web") {
      const { AppState } = require("react-native");
      AppState.addEventListener("change", (state: string) => {
        if (state === "active") {
          _supabase?.auth.startAutoRefresh();
        } else {
          _supabase?.auth.stopAutoRefresh();
        }
      });
    }
  }

  return _supabase;
}

// Export a proxy that lazily initializes the client
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = (client as unknown as Record<string, unknown>)[
      prop as string
    ];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
