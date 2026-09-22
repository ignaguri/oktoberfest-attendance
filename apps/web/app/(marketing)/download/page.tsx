import { PROD_URL } from "@prostcounter/shared/constants";
import type { Metadata } from "next";

import { DownloadContent } from "@/components/marketing/DownloadContent";
import { seoCopy } from "@/lib/marketing/seoCopy";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: seoCopy("en", "download").title,
  description: seoCopy("en", "download").description,
  alternates: {
    canonical: `${PROD_URL}/download`,
    languages: {
      en: `${PROD_URL}/download`,
      de: `${PROD_URL}/de/download`,
      es: `${PROD_URL}/es/download`,
    },
  },
};

export default function DownloadPage() {
  return <DownloadContent />;
}
