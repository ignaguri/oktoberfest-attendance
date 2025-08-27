import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Push notification event handler
self.addEventListener("push", (event) => {
  const pushEvent = event as PushEvent;
  if (!pushEvent.data) return;

  let data;
  try {
    data = pushEvent.data.json();
  } catch {
    data = {
      title: "ProstCounter 🍻",
      body: pushEvent.data.text() || "New notification",
    };
  }

  const options = {
    body: data.body || "New notification from ProstCounter",
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    tag: "prostcounter-notification",
    data: data,
    actions: [
      {
        action: "view",
        title: "View",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
  };

  pushEvent.waitUntil(
    (self as any).registration.showNotification(
      data.title || "ProstCounter 🍻",
      options,
    ),
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  const notificationEvent = event as NotificationEvent;
  notificationEvent.notification.close();

  if (notificationEvent.action === "view" || !notificationEvent.action) {
    notificationEvent.waitUntil(
      (self as any).clients
        .matchAll({ type: "window" })
        .then((clients: any) => {
          // Check if there is already a window/tab open with the target URL
          for (const client of clients) {
            if (
              client.url.includes((self as any).registration.scope) &&
              "focus" in client
            ) {
              return client.focus();
            }
          }
          // If not, open a new window/tab with the target URL
          if ((self as any).clients.openWindow) {
            return (self as any).clients.openWindow("/home");
          }
        }),
    );
  }
  // 'dismiss' action doesn't need any special handling - notification is already closed
});
