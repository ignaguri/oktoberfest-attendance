"use client";

import type { Notification } from "@novu/js";
import { Inbox } from "@novu/nextjs";
import { getNotificationRoute } from "@prostcounter/shared/constants";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useNotifications } from "@/contexts/NotificationContext";

const INBOX_APPEARANCE = {
  elements: {
    bellContainer: { color: "white" },
    bellIcon: { color: "white" },
    popoverContent: {
      width: "80dvw",
      height: "75dvh",
      transform: "translateX(-8px)",
    },
  },
} as const;

export function NotificationBell() {
  const { user, loading } = useNotifications();
  const router = useRouter();

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.data) return;
      const route = getNotificationRoute(notification.data);
      if (route) {
        router.push(route);
      }
    },
    [router],
  );

  if (loading || !user) {
    return null;
  }

  return (
    <Inbox
      applicationIdentifier={process.env.NEXT_PUBLIC_NOVU_APP_ID!}
      subscriberId={user.id}
      onNotificationClick={handleNotificationClick}
      appearance={INBOX_APPEARANCE}
    />
  );
}
