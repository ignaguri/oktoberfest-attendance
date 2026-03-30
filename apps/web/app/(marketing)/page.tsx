import "server-only";

import { PROD_URL } from "@prostcounter/shared/constants";
import { getAppUrl } from "@prostcounter/shared/utils";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

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

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Handle OAuth callback codes
  const params = await searchParams;
  if (params.code) {
    const code = params.code as string;
    const redirectParam = params.redirect as string;

    const callbackUrl = new URL("/auth/callback", getAppUrl());
    callbackUrl.searchParams.set("code", code);
    if (redirectParam) callbackUrl.searchParams.set("redirect", redirectParam);

    redirect(callbackUrl.toString());
  }

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
