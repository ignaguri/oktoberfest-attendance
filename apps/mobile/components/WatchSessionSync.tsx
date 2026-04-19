import { useFestival } from "@prostcounter/shared/contexts";
import { useEffect } from "react";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import { clearSessionOnWatch, syncSessionToWatch } from "@/lib/watch-sync";

export function WatchSessionSync() {
  const { currentFestival } = useFestival();

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    let unsub: (() => void) | undefined;

    const writeIfSignedIn = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token && session.refresh_token && session.user?.id) {
        syncSessionToWatch({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          userId: session.user.id,
          currentFestivalId: currentFestival?.id ?? null,
          expiresAt: session.expires_at ?? 0,
        });
      }
    };

    void writeIfSignedIn();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearSessionOnWatch();
        return;
      }
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        syncSessionToWatch({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          userId: session.user.id,
          currentFestivalId: currentFestival?.id ?? null,
          expiresAt: session.expires_at ?? 0,
        });
      }
    });

    unsub = () => data.subscription.unsubscribe();
    return unsub;
  }, [currentFestival?.id]);

  return null;
}
