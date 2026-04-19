import { useFestival } from "@prostcounter/shared/contexts";
import { useEffect } from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import { clearSessionOnWatch, syncSessionToWatch } from "@/lib/watch-sync";

export function WatchSessionSync() {
  const { currentFestival } = useFestival();

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearSessionOnWatch();
        return;
      }
      if (
        (event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED" ||
          event === "INITIAL_SESSION") &&
        session?.access_token &&
        session.refresh_token &&
        session.user?.id
      ) {
        syncSessionToWatch({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          userId: session.user.id,
          currentFestivalId: currentFestival?.id ?? null,
          expiresAt: session.expires_at ?? 0,
        });
      }
    });

    return () => data.subscription.unsubscribe();
  }, [currentFestival?.id]);

  return null;
}
