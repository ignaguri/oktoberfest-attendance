import type { Metadata } from "next";

import { DownloadContent } from "@/components/marketing/DownloadContent";
import { marketingOpenGraph } from "@/lib/marketing/openGraph";
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
    openGraph: {
      ...marketingOpenGraph({ locale: lang, path: "/download", ...copy }),
      type: "website",
    },
    alternates: {
      canonical: marketingUrlAbsolute("/download", lang),
      languages: localeAlternates("/download"),
    },
  };
}

export default async function DownloadPage({ params }: { params: Promise<Params> }) {
  const { lang: langParam } = await params;
  const lang = toSupportedLanguage(langParam);

  return <DownloadContent />;
}
