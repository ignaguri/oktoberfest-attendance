import { skipWaiting, clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import {
  NetworkFirst,
  StaleWhileRevalidate,
  CacheFirst,
} from "workbox-strategies";

skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

// Offline fallback page
const offlineFallbackPage = "/offline";

// Cache page navigations (html) with a Network First strategy
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: "pages",
    plugins: [
      {
        cacheWillUpdate: async ({ response }) => {
          if (response && response.status === 200) {
            return response;
          }
          return null;
        },
      },
    ],
  }),
  {
    // Optionally, provide a allow list of paths that this route should handle
    // allowlist: ['/'],
    // Optionally, provide a denylist of paths that this route should not handle
    // denylist: [/\/api\//],
  },
);

// Register the navigation route
registerRoute(navigationRoute);

// Fallback to the offline page if a navigation request fails
navigationRoute.setHandler(async (params) => {
  try {
    return await navigationRoute.handler.handle(params);
  } catch (error) {
    return caches.match(offlineFallbackPage);
  }
});

// Cache CSS, JS, and Web Worker requests with a Stale While Revalidate strategy
registerRoute(
  ({ request }) =>
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "worker",
  new StaleWhileRevalidate({
    cacheName: "assets",
  }),
);

// Cache images with a Cache First strategy
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images",
    plugins: [
      {
        cacheWillUpdate: async ({ response }) => {
          if (response && response.status === 200) {
            return response;
          }
          return null;
        },
      },
    ],
  }),
);

// Cache API routes with a Network First strategy
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "api-cache",
    plugins: [
      {
        cacheWillUpdate: async ({ response }) => {
          if (response && response.status === 200) {
            return response;
          }
          return null;
        },
      },
    ],
  }),
);
