import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import AppInstallBanner from "@/components/AppInstallBanner";
import Breadcrumbs from "@/components/Breadcrumbs/Breadcrumbs";
import ErrorBoundary from "@/components/ErrorBoundary";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import Navbar from "@/components/Navbar";
import { OfflineBanner } from "@/components/OfflineBanner";
import { VersionChecker } from "@/components/VersionChecker";
import { WhatsNew } from "@/components/WhatsNew";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { WebFestivalProvider } from "@/contexts/WebFestivalProvider";
import { getUser } from "@/lib/sharedActions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Keep private routes fully dynamic (auth-dependent)
export const revalidate = 0;

async function AuthCheck() {
  try {
    await getUser();
  } catch {
    redirect("/sign-in");
  }

  return null;
}

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebFestivalProvider>
      <NotificationProvider>
        <div className="flex min-h-screen flex-col items-center justify-center pb-2">
          <Navbar />
          <OfflineBanner />
          <main className="flex w-full flex-1 shrink-0 flex-col items-center p-2 text-center sm:justify-start sm:px-20">
            <Breadcrumbs />
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <AuthCheck />
                {children}
                <WhatsNew />
                <VersionChecker />
                <AppInstallBanner />
              </Suspense>
            </ErrorBoundary>
          </main>
          <Footer isLoggedIn />
        </div>
      </NotificationProvider>
    </WebFestivalProvider>
  );
}
