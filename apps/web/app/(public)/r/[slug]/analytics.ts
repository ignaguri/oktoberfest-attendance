import { logger } from "@/lib/logger";
import { IS_PROD } from "@prostcounter/shared/constants";

type RedirectSlug = "bugs" | "feedback" | "donate" | "github";

/**
 * Track redirect events in Google Analytics
 * @param slug - The redirect slug that was accessed
 * @param destinationUrl - The URL the user was redirected to
 */
export function trackRedirect(
  slug: RedirectSlug,
  destinationUrl: string,
): void {
  // Only track in production
  if (!IS_PROD) {
    logger.debug("Redirect tracked", {
      slug,
      destinationUrl,
      source: "analytics",
    });
    return;
  }

  // Track in Google Analytics if available
  if (typeof window !== "undefined" && "gtag" in window) {
    const gtag = (window as any).gtag;

    gtag("event", "redirect_clicked", {
      event_category: "External Links",
      event_label: `Redirect: ${slug}`,
      value: 1,
      custom_parameters: {
        redirect_slug: slug,
        destination_url: destinationUrl,
        redirect_source: "footer",
      },
    });
  }
}
