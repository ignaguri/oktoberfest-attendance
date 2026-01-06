import { createApiClient } from "@prostcounter/api-client";
import Constants from "expo-constants";

import { supabase } from "./supabase";

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  (typeof process !== "undefined" ? process.env.EXPO_PUBLIC_API_URL : "") ||
  "http://localhost:3008/api";

export const apiClient = createApiClient({
  baseUrl: API_URL,
  getAuthToken: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  },
});
