import ErrorBoundary from "@/components/ErrorBoundary";
import LoadingSpinner from "@/components/LoadingSpinner";
import { VersionChecker } from "@/components/VersionChecker";
import { WhatsNew } from "@/components/WhatsNew";
import { getUser } from "@/lib/actions";
import { redirect } from "next/navigation";
import { Suspense } from "react";

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
