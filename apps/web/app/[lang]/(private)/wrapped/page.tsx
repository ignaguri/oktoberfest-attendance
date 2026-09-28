"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useWrapped, useWrappedFestivals } from "@prostcounter/shared/hooks";
import { formatLocalized } from "@prostcounter/shared/utils";
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
  if (result.status === "locked") {
    // Browser timezone is right: it is the same instant as 00:00 at the festival
    const unlocksAt = new Date(result.unlocksAt);
    return (
      <WrappedError
        title={t("wrapped.locked.title")}
        message={t("wrapped.locked.description", {
          date: formatLocalized(unlocksAt, "PPP"),
          time: formatLocalized(unlocksAt, "p"),
        })}
        emoji="🔒"
      />
    );
  }
  if (result.status === "not_attended") {
    return (
      <WrappedError
        title={t("wrapped.notAttended.title")}
        message={t("wrapped.notAttended.description")}
        emoji="🍺"
      />
    );
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
