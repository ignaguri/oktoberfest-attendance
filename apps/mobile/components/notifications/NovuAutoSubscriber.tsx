/**
 * NovuAutoSubscriber
 *
 * Automatically registers the authenticated user as a Novu subscriber
 * on login. This ensures in-app notifications work for all users without
 * requiring them to manually enable push in settings.
 *
 * Push token registration still requires explicit user action (permissions).
 */

import { useCurrentProfile, useSubscribeToNotifications } from "@prostcounter/shared/hooks";
import { splitFullName } from "@prostcounter/shared/utils";
import { useEffect, useRef } from "react";

import { useAuth } from "@/lib/auth/AuthContext";
import { getAvatarUrl } from "@/lib/image-urls";
import { logger } from "@/lib/logger";

export function NovuAutoSubscriber() {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const subscribeToNotifications = useSubscribeToNotifications();
  const hasSubscribed = useRef(false);

  useEffect(() => {
    // Only subscribe once per session, when we have both user and profile
    if (!user?.id || !profile || hasSubscribed.current) return;

    // Don't re-subscribe if already in progress
    if (subscribeToNotifications.loading) return;

    const subscribe = async () => {
      try {
        const fullAvatarUrl = getAvatarUrl(profile.avatar_url);
        const { firstName, lastName } = splitFullName(profile.full_name);

        const result = await subscribeToNotifications.mutateAsync({
          ...(profile.email && { email: profile.email }),
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(fullAvatarUrl && { avatar: fullAvatarUrl }),
        });

        if (result.success) {
          hasSubscribed.current = true;
          logger.debug("[NovuAutoSubscriber] User registered as Novu subscriber");
        } else {
          logger.warn("[NovuAutoSubscriber] Subscribe failed:", result.error);
        }
      } catch (error) {
        // Don't crash the app for failed subscriber registration
        logger.error("[NovuAutoSubscriber] Error subscribing:", error);
      }
    };

    subscribe();
  }, [user?.id, profile, subscribeToNotifications]);

  return null;
}
