import "server-only";

import { PROD_URL } from "@prostcounter/shared/constants";
import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import { getAppUrl } from "@prostcounter/shared/utils";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LandingContent } from "@/components/marketing/LandingContent";
import { SyncLocale } from "@/components/marketing/SyncLocale";
import { JsonLd } from "@/components/seo/JsonLd";
import { NON_DEFAULT_LOCALES } from "@/lib/blog";

export const revalidate = 86400;

type Params = { locale: string };

export async function generateStaticParams(): Promise<Params[]> {
  return NON_DEFAULT_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!NON_DEFAULT_LOCALES.includes(locale as SupportedLanguage)) return {};

  return {
    alternates: {
      canonical: `${PROD_URL}/${locale}`,
      languages: {
        en: PROD_URL,
        de: `${PROD_URL}/de`,
        es: `${PROD_URL}/es`,
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

  if (!NON_DEFAULT_LOCALES.includes(locale as SupportedLanguage)) {
    notFound();
  }

  // Handle OAuth callback codes (same as English landing)
  const sp = await searchParams;
  if (sp.code) {
    const code = sp.code as string;
    const redirectParam = sp.redirect as string;
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
        url: `${PROD_URL}/android-chrome-512x512.png`,
      },
    },
  };

  return (
    <>
      <SyncLocale locale={locale} />
      <JsonLd data={jsonLd} />
      <LandingContent />
    </>
  );
}
