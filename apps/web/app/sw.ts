import { swLogger } from "@/lib/sw-logger";
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import { CacheFirst, StaleWhileRevalidate, NetworkFirst } from "serwist";

import type { RuntimeCaching } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    versionData?: VersionData;
    clients: Clients;
    registration: ServiceWorkerRegistration;
  }
}

interface VersionData {
  version: string;
  buildTime: string;
  changelog: string[];
  requiresUpdate: boolean;
  lastChecked: string;
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

// App update detection
let updateCheckInterval: number | null = null;

function startUpdateChecking() {
  // Check for updates every 30 minutes
  updateCheckInterval = setInterval(
    async () => {
      try {
        const response = await fetch("/api/version");
        const versionData: VersionData = await response.json();

        // Store version data for comparison
        self.versionData = versionData;

        // Check if there's a new version available
        if (versionData.requiresUpdate) {
          // Notify all clients about the update
          const clients = await self.clients.matchAll();
          clients.forEach((client: Client) => {
            client.postMessage({
              type: "UPDATE_AVAILABLE",
              newVersion: versionData.version,
              changelog: versionData.changelog,
            });
          });
        }
      } catch (error) {
        swLogger.error(
          "Failed to check for updates",
          swLogger.updateCheck(),
          error as Error,
        );
      }
    },
    4 * 60 * 60 * 1000,
  ); // 4 hours
}

// Start update checking when service worker activates
self.addEventListener("activate", () => {
  startUpdateChecking();
});

// Handle messages from the main app
self.addEventListener("message", (event: Event) => {
  const messageEvent = event as MessageEvent;

  if (messageEvent.data?.type === "CHECK_FOR_UPDATES") {
    // Immediate update check requested by the app
    fetch("/api/version")
      .then((response) => response.json())
      .then((versionData: VersionData) => {
        self.versionData = versionData;

        // Notify the client about the check result
        if (messageEvent.ports && messageEvent.ports[0]) {
          messageEvent.ports[0].postMessage({
            type: "VERSION_CHECK_RESULT",
            data: versionData,
          });
        }
      })
      .catch((error) => {
        swLogger.error(
          "Failed to check for updates on message",
          swLogger.updateCheck(),
          error as Error,
        );
        if (messageEvent.ports && messageEvent.ports[0]) {
          messageEvent.ports[0].postMessage({
            type: "VERSION_CHECK_ERROR",
            error: error.message,
          });
        }
      });
  } else if (messageEvent.data?.type === "APPLY_UPDATE") {
    // Apply update by skipping waiting and claiming clients
    if (self.registration.waiting) {
      self.registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }
});

// Clean up interval when service worker is uninstalled
self.addEventListener("beforeuninstall", () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
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
