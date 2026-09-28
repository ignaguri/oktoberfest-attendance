"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useWrapped, useWrappedFestivals } from "@prostcounter/shared/hooks";
import { resolveWrappedFestivalId } from "@prostcounter/shared/wrapped";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { WrappedContainer, WrappedError, WrappedLoading } from "@/components/wrapped/core/WrappedContainer";
import { useTranslation } from "@/lib/i18n/client";

function WrappedPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { currentFestival } = useFestival();
  const { data: festivals, loading: festivalsLoading } = useWrappedFestivals();
  const festivalId = resolveWrappedFestivalId(
    searchParams.get("festivalId") ?? undefined,
    festivals,
    currentFestival?.id,
  );
  const { data: result, loading: wrappedLoading, error } = useWrapped(festivalId);

  if (festivalsLoading || wrappedLoading) {
    return <WrappedLoading />;
  }
  if (error || !result) {
    return <WrappedError message={t("wrapped.loadError")} />;
  }
  if (result.status !== "ready") {
    // Task 8 replaces this with the locked / not-attended views.
    return <WrappedError message={t("wrapped.accessDenied")} />;
  }
  return <WrappedContainer data={result.wrapped} />;
}

export default function WrappedPage() {
  return (
    <Suspense fallback={<WrappedLoading />}>
      <WrappedPageContent />
    </Suspense>
  );
}
