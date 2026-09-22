import "server-only";

import { PROD_URL } from "@prostcounter/shared/constants";
import type { Metadata } from "next";

import { FestivalCountdownBanner } from "@/components/marketing/FestivalCountdownBanner";
import { LandingContent } from "@/components/marketing/LandingContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCountdownFestival } from "@/lib/marketing/getCountdownFestival";
import { marketingOpenGraph } from "@/lib/marketing/openGraph";
import { seoCopy } from "@/lib/marketing/seoCopy";
import { localeAlternates, marketingUrlAbsolute, toSupportedLanguage } from "@/lib/utils/marketingUrl";

export const revalidate = 86400;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang: langParam } = await params;
  const lang = toSupportedLanguage(langParam);
  const copy = seoCopy(lang, "home");

  return {
    title: copy.title,
    description: copy.description,
    openGraph: {
      ...marketingOpenGraph({ locale: lang, path: "/", ...copy }),
      type: "website",
    },
    alternates: {
      canonical: marketingUrlAbsolute("/", lang),
      languages: localeAlternates("/"),
    },
  };
}

// Deliberately takes no searchParams: reading them opts the route out of static
// prerendering. OAuth `?code=` is redirected to /auth/callback in proxy.ts.
export default async function LandingPage({ params }: { params: Promise<Params> }) {
  const { lang: langParam } = await params;
  const lang = toSupportedLanguage(langParam);
  const countdownFestival = await getCountdownFestival();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ProstCounter",
    url: PROD_URL,
    description:
      "Track your beer festival attendance, compete with friends, and keep memories of every Oktoberfest visit.",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "iOS, Android, Web",
    inLanguage: lang,
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
      {countdownFestival && <FestivalCountdownBanner festival={countdownFestival} />}
      <LandingContent />
    </>
  );
}
