"use client";

import { useEffect } from "react";

import { trackRedirect } from "./analytics";

type RedirectSlug = "bugs" | "feedback" | "donate" | "github";

interface RedirectTrackerProps {
  slug: RedirectSlug;
  url: string;
}

export default function RedirectTracker({ slug, url }: RedirectTrackerProps) {
  useEffect(() => {
    // Track the redirect event on the client side
    trackRedirect(slug, url);

    // Perform the redirect after tracking
    window.location.href = url;
  }, [slug, url]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-lg">Redirecting...</div>
        <div className="text-sm text-gray-600">Taking you to {url}</div>
      </div>
    </div>
  );
}
