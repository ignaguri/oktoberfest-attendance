// Minimal Firebase service worker for FCM background messages
// This file is required by Firebase SDK for background message handling

// Import Firebase scripts
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js",
);

// Initialize Firebase - config will be injected dynamically
// Firebase Web API keys are designed to be public and are safe to expose
// However, we'll get the config from the main app to avoid duplication
let firebaseConfig = {};

// Try to get config from the main app if available
try {
  // This will be populated by the main application
  if (self.firebaseConfig) {
    firebaseConfig = self.firebaseConfig;
  } else {
    // Fallback minimal config - you can update these with your actual values
    firebaseConfig = {
      apiKey: "AIzaSyCVUuRzsdPLHabgpTtIP1YVpINSasebzGo",
      projectId: "prostcounter",
      messagingSenderId: "583935564617",
      appId: "1:583935564617:web:3c557fb75d2c8850835898",
    };
  }
} catch (error) {
  // Silent fallback to default config
}

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages when app is not in focus
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || "ProstCounter 🍻";
  const notificationOptions = {
    body: payload.notification?.body || "New notification",
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    tag: "prostcounter-fcm",
    data: payload.data,
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

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions,
  );
});

// Handle notification clicks (for FCM notifications only)
self.addEventListener("notificationclick", (event) => {
  // Only handle FCM notifications (tagged with 'prostcounter-fcm')
  if (event.notification.tag !== "prostcounter-fcm") {
    return;
  }

  event.notification.close();

  if (event.action === "view" || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clients) => {
        // Check if there is already a window/tab open
        for (const client of clients) {
          if (
            client.url.includes(self.registration.scope) &&
            "focus" in client
          ) {
            return client.focus();
          }
        }
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow("/home");
        }
      }),
    );
  }
  // 'dismiss' action handled by closing notification above
});
