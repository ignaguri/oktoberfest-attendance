import { redirect } from "next/navigation";

import { trackRedirect } from "./analytics";

// Predefined redirect mappings
const REDIRECTS = {
  bugs: "https://prostcounter.canny.io/bugs",
  feedback: "https://prostcounter.canny.io/feature-requests",
  donate: "https://www.paypal.me/ignacioguri",
  github: "https://github.com/ignaguri",
} as const;

type RedirectSlug = keyof typeof REDIRECTS;

interface RedirectPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function RedirectPage({ params }: RedirectPageProps) {
  const { slug } = await params;

  // Check if the slug is a valid redirect
  if (slug in REDIRECTS) {
    const url = REDIRECTS[slug as RedirectSlug];

    // Track the redirect event
    trackRedirect(slug as RedirectSlug, url);

    redirect(url);
  }

  // Fallback for invalid redirect slugs
  redirect("/");
}
