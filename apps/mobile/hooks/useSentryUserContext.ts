import { useCurrentProfile } from "@prostcounter/shared/hooks";
import * as Sentry from "@sentry/react-native";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Synchronizes user and profile data with Sentry for error tracking
 *
 * This hook enriches the basic Sentry user context (id, email) set in AuthContext
 * with additional profile information (username) for better debugging.
 *
 * @example
 * ```tsx
 * function RootLayout() {
 *   useSentryUserContext(); // Call at app root level
 *   return <Stack />;
 * }
 * ```
 */
export function useSentryUserContext() {
  const { user, isAuthenticated } = useAuth();
  const { data: profile } = useCurrentProfile();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      Sentry.setUser(null);
      return;
    }

    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: profile?.username || undefined,
    });
  }, [user, isAuthenticated, profile?.username]);
}
