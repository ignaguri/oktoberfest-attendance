"use client";

import type { Notification } from "@novu/js";
import { Inbox } from "@novu/nextjs";
import { getNotificationRoute } from "@prostcounter/shared/constants";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useNotifications } from "@/contexts/NotificationContext";

export function NotificationBell() {
  const { user, loading } = useNotifications();
  const router = useRouter();

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      const payload = notification.data ?? {};
      const route = getNotificationRoute(payload);
      if (route) {
        router.push(route);
      }
    },
    [router],
  );

  // Don't render until loaded or if no user
  if (loading || !user) {
    return null;
  }

  return (
    <Inbox
      applicationIdentifier={process.env.NEXT_PUBLIC_NOVU_APP_ID!}
      subscriberId={user.id}
      onNotificationClick={handleNotificationClick}
      appearance={{
        elements: {
          bellContainer: {
            color: "white",
          },
          bellIcon: {
            color: "white",
          },
          popoverContent: {
            width: "80dvw",
            height: "75dvh",
            transform: "translateX(-8px)",
          },
        },
      }}
    />
  );
}
