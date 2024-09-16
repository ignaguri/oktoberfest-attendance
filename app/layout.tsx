import Breadcrumbs from "@/components/Breadcrumbs/Breadcrumbs";

import "@/styles/globals.css";
import { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { Toaster } from "@/components/ui/toaster";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PROD_URL } from "@/lib/constants";

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
};

export const viewport = {
  initialScale: 1,
  maximumScale: 1,
  width: "device-width",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center">
          <Navbar />
          <OfflineBanner />
          <main className="flex w-full flex-1 shrink-0 flex-col items-center p-2 text-center sm:px-20 sm:justify-start bg-slate-50 mb-4">
            <Breadcrumbs />
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
