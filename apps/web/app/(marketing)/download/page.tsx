import type { Metadata } from "next";

import { DownloadContent } from "@/components/marketing/DownloadContent";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Download ProstCounter - iOS, Android & Web",
  description:
    "Download ProstCounter for free on iOS, Android, or use the web app. Track your beer festival experience on any device.",
};

export default function DownloadPage() {
  return <DownloadContent />;
}
