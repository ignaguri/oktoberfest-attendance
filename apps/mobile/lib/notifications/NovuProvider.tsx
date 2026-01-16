import { useAuth } from "@/lib/auth/AuthContext";
import { NovuProvider as NovuSDKProvider } from "@novu/react-native";

import type { ReactNode } from "react";

/**
 * Novu App ID from environment
 */
const NOVU_APP_ID = process.env.EXPO_PUBLIC_NOVU_APP_ID || "";

/**
 * Novu API configuration for EU region
 */
const NOVU_CONFIG = {
  apiUrl: "https://eu.api.novu.co",
  socketUrl: "wss://eu.ws.novu.co",
};

interface NovuProviderWrapperProps {
  children: ReactNode;
}

/**
 * Novu Provider Wrapper
 *
 * Wraps the Novu SDK provider with user context from AuthContext.
 * Only renders the Novu provider when user is authenticated.
 *
 * Usage:
 * ```tsx
 * <NovuProviderWrapper>
 *   <YourApp />
 * </NovuProviderWrapper>
 * ```
 *
 * Then use hooks from @novu/react-native:
 * - useNotifications() - Get notification list
 * - useCounts() - Get unread count
 */
export function NovuProviderWrapper({ children }: NovuProviderWrapperProps) {
  const { session } = useAuth();

  // Don't render Novu provider if user is not authenticated
  if (!session?.user?.id || !NOVU_APP_ID) {
    return <>{children}</>;
  }

  return (
    <NovuSDKProvider
      subscriber={session.user.id}
      applicationIdentifier={NOVU_APP_ID}
      apiUrl={NOVU_CONFIG.apiUrl}
      socketUrl={NOVU_CONFIG.socketUrl}
    >
      {children}
    </NovuSDKProvider>
  );
}

/**
 * Re-export Novu hooks for convenience
 */
export {
  useCounts,
  useNotifications,
  useNovu,
  usePreferences,
} from "@novu/react-native";
