import { defaultCache } from "@serwist/next/worker";
import {
  CacheFirst,
  StaleWhileRevalidate,
  NetworkFirst,
  Serwist,
} from "serwist";

import type { RuntimeCaching } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

// Type for version data
interface VersionData {
  version: string;
  buildTime: string;
  changelog: string[];
  requiresUpdate: boolean;
  lastChecked: string;
}

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    versionData?: VersionData; // Properly typed version data
  }
}

declare const self: WorkerGlobalScope;

// Custom caching strategies optimized for PWA performance
const customRuntimeCaching: RuntimeCaching[] = [
  // Image API routes - Cache First for better iOS performance
  {
    matcher: ({ url }) => url.pathname.startsWith("/api/image/"),
    handler: new CacheFirst({
      cacheName: "user-uploaded-images",
      plugins: [
        {
          cacheKeyWillBeUsed: async ({ request }) => {
            // Include bucket parameter in cache key
            return request.url;
          },
          cacheWillUpdate: async ({ response }) => {
            // Only cache successful responses
            return response && response.status === 200 ? response : null;
          },
        },
      ],
    }),
  },
  // Static images (avatars, icons) - Cache First with longer expiration
  {
    matcher: ({ request }) =>
      request.destination === "image" &&
      (request.url.includes("/images/") || request.url.includes("/icons/")),
    handler: new CacheFirst({
      cacheName: "static-image-assets",
    }),
  },
  // Supabase storage images - Cache First for performance
  {
    matcher: ({ url }) => url.hostname.includes("supabase"),
    handler: new CacheFirst({
      cacheName: "supabase-storage",
    }),
  },
  // API routes - Network First for fresh data
  {
    matcher: ({ url }) =>
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/image/"),
    handler: new NetworkFirst({
      cacheName: "api-cache",
      networkTimeoutSeconds: 3,
    }),
  },
  // Static assets (CSS, JS) - Stale While Revalidate
  {
    matcher: ({ request }) =>
      request.destination === "style" ||
      request.destination === "script" ||
      request.destination === "worker",
    handler: new StaleWhileRevalidate({
      cacheName: "static-assets",
    }),
  },
  // Default cache strategy for other requests
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: customRuntimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Version checking and update detection
let updateCheckInterval: NodeJS.Timeout;

// Check for updates every 30 minutes
const startUpdateChecking = () => {
  updateCheckInterval = setInterval(
    async () => {
      try {
        const response = await fetch("/api/version", { cache: "no-cache" });
        if (response.ok) {
          const versionData: VersionData = await response.json();
          // Store version data for comparison
          self.versionData = versionData;
        }
      } catch (error) {
        console.log("Version check failed:", error);
      }
    },
    30 * 60 * 1000,
  ); // 30 minutes
};

// Check for updates immediately and start interval
startUpdateChecking();

// Cleanup interval when service worker is uninstalled
self.addEventListener("beforeuninstall", () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
});

// Handle app focus events for immediate update checks
// Note: We use Event type and cast to MessageEvent because service workers
// don't have built-in message event types in WorkerGlobalScopeEventMap
self.addEventListener("message", (event: Event) => {
  // Type guard for message data
  const messageEvent = event as MessageEvent;
  if (
    messageEvent.data &&
    typeof messageEvent.data === "object" &&
    "type" in messageEvent.data &&
    messageEvent.data.type === "CHECK_FOR_UPDATES"
  ) {
    // Immediate version check when app comes into focus
    fetch("/api/version", { cache: "no-cache" })
      .then((response) => response.json())
      .then((versionData: VersionData) => {
        self.versionData = versionData;
        // Notify all clients about potential update
        if (messageEvent.ports && messageEvent.ports[0]) {
          messageEvent.ports[0].postMessage({
            type: "VERSION_CHECK_RESULT",
            data: versionData,
          });
        }
      })
      .catch((error) => {
        console.log("Immediate version check failed:", error);
        if (messageEvent.ports && messageEvent.ports[0]) {
          messageEvent.ports[0].postMessage({
            type: "VERSION_CHECK_ERROR",
            error: error.message,
          });
        }
      });
  }
});

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
