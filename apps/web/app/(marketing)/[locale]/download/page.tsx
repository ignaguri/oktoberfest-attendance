import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DownloadContent } from "@/components/marketing/DownloadContent";
import { SyncLocale } from "@/components/marketing/SyncLocale";
import type { BlogLocale } from "@/lib/blog";
import { NON_DEFAULT_LOCALES } from "@/lib/blog";

export const revalidate = 86400;

type Params = { locale: string };

export async function generateStaticParams(): Promise<Params[]> {
  return NON_DEFAULT_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!NON_DEFAULT_LOCALES.includes(locale as BlogLocale)) return {};

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

  if (!NON_DEFAULT_LOCALES.includes(locale as BlogLocale)) {
    notFound();
  }

  return (
    <>
      <SyncLocale locale={locale} />
      <DownloadContent />
    </>
  );
}
