import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DownloadContent } from "@/components/marketing/DownloadContent";

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
    title: "Download ProstCounter - iOS, Android & Web",
    description:
      "Download ProstCounter for free on iOS, Android, or use the web app. Track your beer festival experience on any device.",
    alternates: {
      canonical: `https://prostcounter.fun/${locale}/download`,
      languages: {
        en: "https://prostcounter.fun/download",
        de: "https://prostcounter.fun/de/download",
        es: "https://prostcounter.fun/es/download",
      },
    },
  };
}

export default async function LocalizedDownloadPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale } = await params;

  if (!VALID_LOCALES.includes(locale as ValidLocale)) {
    notFound();
  }

  return <DownloadContent />;
}
