"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useWrapped, useWrappedFestivals } from "@prostcounter/shared/hooks";
import { formatLocalized } from "@prostcounter/shared/utils";
import { buildWrappedStory, resolveWrappedFestivalId } from "@prostcounter/shared/wrapped";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { StoryShell } from "@/components/wrapped/story/StoryShell";
import { WrappedError, WrappedLoading } from "@/components/wrapped/story/StoryStates";
import { useTranslation } from "@/lib/i18n/client";

function WrappedPageContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentFestival } = useFestival();
  const {
    data: festivals,
    loading: festivalsLoading,
    error: festivalsError,
  } = useWrappedFestivals();
  const festivalId = resolveWrappedFestivalId(
    searchParams.get("festivalId") ?? undefined,
    festivals,
    currentFestival?.id,
  );
  const { data: result, loading: wrappedLoading, error } = useWrapped(festivalId);

  // Built once per ready payload, before any early return: a refetch that changes the slide
  // count would otherwise leave the shell's reducer holding a stale `total`.
  const readyResult = result?.status === "ready" ? result : null;
  const slides = useMemo(() => {
    if (!readyResult) {
      return null;
    }
    return buildWrappedStory(readyResult.wrapped, readyResult.officialStats);
  }, [readyResult]);

  if (festivalsLoading || wrappedLoading) {
    return <WrappedLoading />;
  }
  if (festivalsError) {
    return <WrappedError message={t("wrapped.loadError")} />;
  }
  // No link, no unlocked Wrapped and no current festival: nothing to open
  if (!festivalId) {
    return (
      <WrappedError
        title={t("wrapped.notAttended.title")}
        message={t("wrapped.notAttended.description")}
      />
    );
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
      />
    );
  }
  if (result.status === "not_attended") {
    return (
      <WrappedError
        title={t("wrapped.notAttended.title")}
        message={t("wrapped.notAttended.description")}
      />
    );
  }
  if (!slides) {
    return null;
  }
  return (
    // Keyed on slide count: a refetch that changes it remounts the shell.
    <StoryShell
      key={slides.length}
      data={result.wrapped}
      slides={slides}
      onClose={() => router.back()}
    />
  );
}

export default function WrappedPage() {
  return (
    <Suspense fallback={<WrappedLoading />}>
      <WrappedPageContent />
    </Suspense>
  );
}
