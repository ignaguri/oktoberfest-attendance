"use client";

import { useNotifications } from "@/contexts/NotificationContext";
import { Inbox } from "@novu/nextjs";

export function NotificationBell() {
  const { user, loading } = useNotifications();

  // Don't render until loaded or if no user
  if (loading || !user) {
    return null;
  }

  return (
    <Inbox
      applicationIdentifier={process.env.NEXT_PUBLIC_NOVU_APP_ID!}
      subscriberId={user.id}
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
