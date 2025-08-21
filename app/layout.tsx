import "@/styles/globals.css";
import Breadcrumbs from "@/components/Breadcrumbs/Breadcrumbs";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Toaster } from "@/components/ui/toaster";
import { FestivalProvider } from "@/contexts/FestivalContext";
import { GA_ID, IS_PROD, PROD_URL } from "@/lib/constants";
import { getUser } from "@/lib/sharedActions";
import { APP_VERSION } from "@/version";
import { GoogleAnalytics } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ViewTransitions } from "next-view-transitions";

import type { Metadata } from "next";

// do not cache this layout
export const revalidate = 0;

const ogImages = [
  "/images/prost-counter-og-1.jpg",
  "/images/prost-counter-og-2.jpg",
  "/images/prost-counter-og-3.jpg",
  "/images/prost-counter-og-4.jpg",
  "/images/prost-counter-og-5.jpg",
  "/images/prost-counter-og-6.jpg",
  "/images/prost-counter-og-7.jpg",
];

const getRandomImage = () =>
  ogImages[Math.floor(Math.random() * ogImages.length)];

export const metadata: Metadata = {
  description: "Track your Oktoberfest attendance and compete with friends!",
  title: "ProstCounter 🍻",
  openGraph: {
    title: "ProstCounter 🍻",
    description: "Join your friends in tracking Oktoberfest attendance!",
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
    description: "Join your friends in tracking Oktoberfest attendance!",
    images: [getRandomImage()],
    creator: "@ignaguri",
  },
  manifest: "/manifest.json",
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
  maximumScale: 1,
  width: "device-width",
  themeColor: "#ffffff",
};

async function checkUser() {
  try {
    await getUser();
    return true;
  } catch (error) {
    return false;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLoggedIn = await checkUser();

  const AppContent = () => (
    <div className="flex min-h-screen flex-col items-center justify-center pb-2">
      <Navbar />
      <OfflineBanner />
      <main className="flex w-full flex-1 shrink-0 flex-col items-center p-2 text-center sm:px-20 sm:justify-start">
        <Breadcrumbs />
        {children}
      </main>
      <Footer isLoggedIn={isLoggedIn} />
    </div>
  );

  return (
    <ViewTransitions>
      <html lang="en" data-version={APP_VERSION}>
        <body className="bg-slate-50">
          {isLoggedIn ? (
            <FestivalProvider>
              <AppContent />
            </FestivalProvider>
          ) : (
            <AppContent />
          )}
          <Toaster />
          <SpeedInsights />
          {IS_PROD && <GoogleAnalytics gaId={GA_ID} />}
        </body>
      </html>
    </ViewTransitions>
  );
}
