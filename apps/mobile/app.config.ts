import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "ProstCounter",
  slug: "prostcounter",
  version: "1.0.1",
  orientation: "portrait",
  scheme: "prostcounter",
  icon: "./assets/images/logo.png",
  userInterfaceStyle: "automatic",
  runtimeVersion: "1.0.1-j",
  updates: {
    url: "https://u.expo.dev/fca65703-ce2a-48b3-aec4-11a90fbb8996",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.prostcounter.app",
    usesAppleSignIn: true,
    googleServicesFile: "./GoogleService-Info.plist",
    associatedDomains: [
      "applinks:prostcounter.fun",
      "applinks:www.prostcounter.fun",
    ],
    infoPlist: {
      NSFaceIDUsageDescription:
        "Use Face ID to quickly sign in to your ProstCounter account",
      NSPhotoLibraryUsageDescription:
        "ProstCounter needs access to your photo library to let you upload beer pictures to your daily attendance log and share them with your group members in the gallery. For example, you can select a photo of your beer to document your Oktoberfest experience.",
      NSCameraUsageDescription:
        "ProstCounter needs access to your camera to let you take photos of your beers and add them to your daily attendance records. For example, you can take a picture of your beer to share with friends in your group's photo gallery.",
      NSLocationWhenInUseUsageDescription:
        "ProstCounter uses your location to share with friends and show nearby tents",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Allow background location to keep sharing your location with friends while using other apps",
      UIBackgroundModes: [
        "remote-notification",
        "location",
        "fetch",
        "processing",
      ],
      BGTaskSchedulerPermittedIdentifiers: [
        "PROSTCOUNTER_BACKGROUND_SYNC",
        "PROSTCOUNTER_BACKGROUND_LOCATION",
      ],
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: {
          localhost: {
            NSExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
      LSApplicationQueriesSchemes: ["whatsapp"],
    },
    config: {
      usesNonExemptEncryption: false,
    },
    appleTeamId: "4Q9U9B3BKC",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#FBBF24",
    },
    package: "com.prostcounter.app",
    googleServicesFile: "./google-services.json",
    permissions: [
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_LOCATION",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "prostcounter.fun",
            pathPrefix: "/join-group",
          },
          {
            scheme: "https",
            host: "www.prostcounter.fun",
            pathPrefix: "/join-group",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-screen.png",
        backgroundColor: "#FBBF24",
        resizeMode: "cover",
        enableFullScreenImage_legacy: true,
      },
    ],
    "expo-router",
    "expo-secure-store",
    "expo-localization",
    "expo-local-authentication",
    "expo-web-browser",
    "expo-apple-authentication",
    [
      "expo-image-picker",
      {
        microphonePermission: false,
      },
    ],
    "expo-font",
    [
      "expo-notifications",
      {
        color: "#FBBF24",
      },
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Allow ProstCounter to share your location with friends and detect nearby tents",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    "./plugins/withModularHeaders.js",
    "./plugins/withFirebaseNotificationColor.js",
    "./plugins/withGoogleMapsApiKey.js",
    "expo-maps",
    "expo-updates",
    [
      "@sentry/react-native/expo",
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: "fca65703-ce2a-48b3-aec4-11a90fbb8996",
    },
    // Note: Environment variables (EXPO_PUBLIC_*) are accessed directly via process.env
    // at build time. They're NOT included here to avoid fingerprint mismatches between
    // local and EAS builds. See lib/supabase.ts, lib/api-client.ts, lib/sentry.ts
  },
  owner: "pepegrillo",
});
