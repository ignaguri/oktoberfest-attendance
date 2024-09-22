import { Suspense } from "react";
import { redirect } from "next/navigation";

import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getUser } from "@/lib/actions";
import { WhatsNew } from "@/components/WhatsNew";
import { VersionChecker } from "@/components/VersionChecker";

async function AuthCheck() {
  try {
    await getUser();
  } catch (error) {
    redirect("/sign-in");
  }

  return null;
}

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <AuthCheck />
        {children}
        <WhatsNew />
        <VersionChecker />
      </Suspense>
    </ErrorBoundary>
  );
}
