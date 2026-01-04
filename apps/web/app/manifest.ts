import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProstCounter 🍻",
    short_name: "ProstCounter",
    description:
      "Track your beer festival attendance and compete with friends!",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F59E0B",
    theme_color: "#FBBF24",
    lang: "en-US",
    scope: "/",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Track Attendance",
        short_name: "Attendance",
        description: "Track your beer festival attendance and consumption",
        url: "/attendance",
        icons: [
          {
            src: "/favicon-96x96.png",
            sizes: "96x96",
            type: "image/png",
          },
        ],
      },
      {
        name: "My Groups",
        short_name: "Groups",
        description: "Manage your festival groups and competitions",
        url: "/groups",
        icons: [
          {
            src: "/favicon-96x96.png",
            sizes: "96x96",
            type: "image/png",
          },
        ],
      },
      {
        name: "Achievements",
        short_name: "Achievements",
        description: "View your progress and unlock achievements",
        url: "/achievements",
        icons: [
          {
            src: "/favicon-96x96.png",
            sizes: "96x96",
            type: "image/png",
          },
        ],
      },
    ],
    categories: ["entertainment", "social", "lifestyle"],
  };
}
