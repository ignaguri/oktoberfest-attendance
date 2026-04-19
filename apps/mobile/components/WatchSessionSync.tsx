import { useFestival } from "@prostcounter/shared/contexts";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/lib/auth/AuthContext";
import { clearSessionOnWatch, syncSessionToWatch } from "@/lib/watch-sync";

export function WatchSessionSync() {
  const { session } = useAuth();
  const { currentFestival } = useFestival();

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    if (!session) {
      clearSessionOnWatch();
      return;
    }

    const { access_token, refresh_token, expires_at, user } = session;
    if (!access_token || !refresh_token || !user?.id) return;

    syncSessionToWatch({
      accessToken: access_token,
      refreshToken: refresh_token,
      userId: user.id,
      currentFestivalId: currentFestival?.id ?? null,
      expiresAt: expires_at ?? 0,
    });
  }, [
    session?.access_token,
    session?.refresh_token,
    session?.expires_at,
    session?.user?.id,
    currentFestival?.id,
  ]);

  return null;
}
