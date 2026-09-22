import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import type { Metadata } from "next";

import { DownloadContent } from "@/components/marketing/DownloadContent";
import { SyncLocale } from "@/components/marketing/SyncLocale";
import { seoCopy } from "@/lib/marketing/seoCopy";
import { localeAlternates, marketingUrlAbsolute, toSupportedLanguage } from "@/lib/utils/marketingUrl";

export const revalidate = 86400;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang: langParam } = await params;
  const lang = toSupportedLanguage(langParam);
  const copy = seoCopy(lang, "download");

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: marketingUrlAbsolute("/download", lang),
      languages: localeAlternates("/download"),
    },
  };
}

export default async function DownloadPage({ params }: { params: Promise<Params> }) {
  const { lang: langParam } = await params;
  const lang = toSupportedLanguage(langParam);

  return (
    <>
      <SyncLocale locale={lang} />
      <DownloadContent />
    </>
  );
}
