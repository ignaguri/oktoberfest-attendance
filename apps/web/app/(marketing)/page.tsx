import "server-only";

import { PROD_URL } from "@prostcounter/shared/constants";
import type { Metadata } from "next";

import { LandingContent } from "@/components/marketing/LandingContent";
import { JsonLd } from "@/components/seo/JsonLd";

export const revalidate = 86400;

export const metadata: Metadata = {
  alternates: {
    canonical: PROD_URL,
    languages: {
      en: PROD_URL,
      de: `${PROD_URL}/de`,
      es: `${PROD_URL}/es`,
    },
  },
};

// Deliberately takes no searchParams: reading them opts the route out of static
// prerendering. OAuth `?code=` is redirected to /auth/callback in proxy.ts.
export default async function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ProstCounter",
    url: PROD_URL,
    description:
      "Track your beer festival attendance, compete with friends, and keep memories of every Oktoberfest visit.",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "iOS, Android, Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    publisher: {
      "@type": "Organization",
      name: "ProstCounter",
      logo: {
        "@type": "ImageObject",
        url: `${PROD_URL}/android-chrome-512x512.png`,
      },
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <LandingContent />
    </>
  );
}
