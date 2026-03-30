import "server-only";

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LandingContent } from "@/components/marketing/LandingContent";
import { JsonLd } from "@/components/seo/JsonLd";

export const revalidate = 86400;

const VALID_LOCALES = ["de", "es"] as const;
type ValidLocale = (typeof VALID_LOCALES)[number];

type Params = { locale: string };

export async function generateStaticParams(): Promise<Params[]> {
  return VALID_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!VALID_LOCALES.includes(locale as ValidLocale)) return {};

  return {
    alternates: {
      canonical: `https://prostcounter.fun/${locale}`,
      languages: {
        en: "https://prostcounter.fun",
        de: "https://prostcounter.fun/de",
        es: "https://prostcounter.fun/es",
      },
    },
  };
}

export default async function LocalizedLandingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;

  if (!VALID_LOCALES.includes(locale as ValidLocale)) {
    notFound();
  }

  // Handle OAuth callback codes (same as English landing)
  const sp = await searchParams;
  if (sp.code) {
    const code = sp.code as string;
    const redirectParam = sp.redirect as string;
    const callbackUrl = new URL(
      "/auth/callback",
      process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : "http://localhost:3000",
    );
    callbackUrl.searchParams.set("code", code);
    if (redirectParam) callbackUrl.searchParams.set("redirect", redirectParam);
    redirect(callbackUrl.toString());
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ProstCounter",
    url: "https://prostcounter.fun",
    description:
      "Track your beer festival attendance, compete with friends, and keep memories of every Oktoberfest visit.",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "iOS, Android, Web",
    inLanguage: locale,
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
        url: "https://prostcounter.fun/android-chrome-512x512.png",
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
