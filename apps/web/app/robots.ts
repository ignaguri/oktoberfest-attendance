import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/home",
          "/attendance",
          "/calendar",
          "/achievements",
          "/leaderboard",
          "/groups",
          "/group-settings",
          "/profile",
          "/update-password",
          "/wrapped",
          "/friends",
          "/admin",
          "/join-group",
          "/auth/",
        ],
      },
    ],
    sitemap: "https://prostcounter.fun/sitemap.xml",
  };
}
