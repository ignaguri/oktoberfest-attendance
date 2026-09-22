import "@/styles/globals.css";

import { GoogleAnalytics } from "@next/third-parties/google";
import { DEV_URL, IS_PROD, PROD_URL } from "@prostcounter/shared/constants";
import { SUPPORTED_LANGUAGES } from "@prostcounter/shared/i18n/core";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { ViewTransitions } from "next-view-transitions";

import { Toaster } from "@/components/ui/sonner";
import { GA_ID } from "@/lib/constants";
import { DataProvider } from "@/lib/data/query-client";
import { I18nProvider } from "@/lib/i18n/client";
import { randomOgImage } from "@/lib/marketing/openGraph";
import { APP_VERSION } from "@/lib/version";

import { SerwistProvider } from "../serwist-provider";

// Only the fallback for routes that set no openGraph of their own; every
// marketing page builds a localized block instead. See lib/marketing/openGraph.
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
        url: randomOgImage(),
        width: 1200,
        height: 670,
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
    images: [randomOgImage()],
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

// Every page sits under this segment so that `lang` is known here, where <html>
// is rendered. Nothing above a layout can read a route param, so this is the
// only place the document language can be set correctly per locale.
export function generateStaticParams() {
  return SUPPORTED_LANGUAGES.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <ViewTransitions>
      <html lang={lang} data-version={APP_VERSION}>
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
