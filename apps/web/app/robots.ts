import { PROD_URL } from "@prostcounter/shared/constants";
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
          "/sign-in",
          "/sign-up",
        ],
      },
    ],
    sitemap: `${PROD_URL}/sitemap.xml`,
  };
}
