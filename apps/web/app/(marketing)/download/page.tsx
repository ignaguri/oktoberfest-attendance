import { PROD_URL } from "@prostcounter/shared/constants";
import type { Metadata } from "next";

import { DownloadContent } from "@/components/marketing/DownloadContent";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Download ProstCounter - iOS, Android & Web",
  description:
    "Download ProstCounter for free on iOS, Android, or use the web app. Track your beer festival experience on any device.",
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
