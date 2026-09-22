import { PROD_URL } from "@prostcounter/shared/constants";
import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DownloadContent } from "@/components/marketing/DownloadContent";
import { SyncLocale } from "@/components/marketing/SyncLocale";
import { NON_DEFAULT_LOCALES } from "@/lib/constants";
import { seoCopy } from "@/lib/marketing/seoCopy";

export const revalidate = 86400;

type Params = { locale: string };

export async function generateStaticParams(): Promise<Params[]> {
  return NON_DEFAULT_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!NON_DEFAULT_LOCALES.includes(locale as SupportedLanguage)) return {};

  const copy = seoCopy(locale as SupportedLanguage, "download");

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: `${PROD_URL}/${locale}/download`,
      languages: {
        en: `${PROD_URL}/download`,
        de: `${PROD_URL}/de/download`,
        es: `${PROD_URL}/es/download`,
      },
    },
  };
}

export default async function LocalizedDownloadPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  if (!NON_DEFAULT_LOCALES.includes(locale as SupportedLanguage)) {
    notFound();
  }

  return (
    <>
      <SyncLocale locale={locale} />
      <DownloadContent />
    </>
  );
}
