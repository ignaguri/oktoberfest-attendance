import "@/styles/globals.css";

import { GoogleAnalytics } from "@next/third-parties/google";
import { DEV_URL, IS_PROD, PROD_URL } from "@prostcounter/shared/constants";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { ViewTransitions } from "next-view-transitions";

import { Toaster } from "@/components/ui/sonner";
import { GA_ID } from "@/lib/constants";
import { DataProvider } from "@/lib/data/query-client";
import { I18nProvider } from "@/lib/i18n/client";
import { APP_VERSION } from "@/lib/version";

import { SerwistProvider } from "./serwist-provider";

const ogImages = [
  "/images/prost-counter-og-1.jpg",
  "/images/prost-counter-og-2.jpg",
  "/images/prost-counter-og-3.jpg",
  "/images/prost-counter-og-4.jpg",
  "/images/prost-counter-og-5.jpg",
  "/images/prost-counter-og-6.jpg",
  "/images/prost-counter-og-7.jpg",
];

const getRandomImage = () => ogImages[Math.floor(Math.random() * ogImages.length)];

export const metadata: Metadata = {
  metadataBase: new URL(IS_PROD ? PROD_URL : DEV_URL),
  description: "Track your beer festival attendance and compete with friends!",
  title: "ProstCounter 🍻",
  openGraph: {
    title: "ProstCounter 🍻",
    description: "Join your friends in tracking beer festival attendance!",
    url: PROD_URL,
    images: [
      {
        url: getRandomImage(),
        width: 1200,
        height: 630,
        alt: "ProstCounter",
      },
    ],
    siteName: "ProstCounter",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProstCounter 🍻",
    description: "Join your friends in tracking beer festival attendance!",
    images: [getRandomImage()],
    creator: "@ignaguri",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ProstCounter",
  },
  applicationName: "ProstCounter",
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  initialScale: 1,
  width: "device-width",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransitions>
      <html lang="en" data-version={APP_VERSION}>
        <body className="bg-slate-50">
          <SerwistProvider swUrl="/serwist/sw.js">
            <DataProvider>
              <I18nProvider>{children}</I18nProvider>
            </DataProvider>
            <Toaster richColors closeButton />
            <SpeedInsights />
            {IS_PROD && <GoogleAnalytics gaId={GA_ID} />}
          </SerwistProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
