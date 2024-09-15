import Breadcrumbs from "@/components/Breadcrumbs/Breadcrumbs";

import "@/styles/globals.css";
import { Metadata } from "next";
import Navbar from "@/components/Navbar";
import { Toaster } from "@/components/ui/toaster";
import { OfflineBanner } from "@/components/OfflineBanner";

// do not cache this layout
export const revalidate = 0;

export const metadata: Metadata = {
  description: "Track your Oktoberfest attendance and compete with friends!",
  title: "ProstCounter 🍻",
  openGraph: {
    title: "ProstCounter 🍻",
    description: "Join your friends in tracking Oktoberfest attendance!",
    url: "https://oktoberfest-attendance.vercel.app/",
    siteName: "ProstCounter",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ProstCounter 🍻",
    description: "Join your friends in tracking Oktoberfest attendance!",
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
