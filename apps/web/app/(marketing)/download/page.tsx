import type { Metadata } from "next";

import { DownloadContent } from "@/components/marketing/DownloadContent";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Download ProstCounter - iOS, Android & Web",
  description:
    "Download ProstCounter for free on iOS, Android, or use the web app. Track your beer festival experience on any device.",
  alternates: {
    canonical: "https://prostcounter.fun/download",
    languages: {
      en: "https://prostcounter.fun/download",
      de: "https://prostcounter.fun/de/download",
      es: "https://prostcounter.fun/es/download",
    },
  },
};

export default function DownloadPage() {
  return <DownloadContent />;
}
