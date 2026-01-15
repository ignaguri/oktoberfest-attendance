"use client";

import {
  WrappedContainer,
  WrappedError,
} from "@/components/wrapped/core/WrappedContainer";
import { useWrappedAccess, useWrappedData } from "@/hooks/useWrapped";
import { useTranslation } from "@/lib/i18n/client";
import { useFestival } from "@prostcounter/shared/contexts";

export default function WrappedPage() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const festivalId = currentFestival?.id;

  // Use direct Supabase call for wrapped data (preserves DB format for slides)
  const { data: wrappedData, loading: wrappedLoading } =
    useWrappedData(festivalId);
  const { data: accessResult, loading: accessLoading } =
    useWrappedAccess(festivalId);

  // Loading state
  if (wrappedLoading || accessLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-6xl">🍺</div>
          <p className="text-gray-600">{t("wrapped.loading")}</p>
        </div>
      </div>
    );
  }

  // Access denied
  if (accessResult && !accessResult.allowed) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md px-6 text-center">
          <div className="mb-4 text-6xl">🔒</div>
          <h2 className="mb-2 text-2xl font-bold text-gray-800">
            {t("wrapped.notAvailable")}
          </h2>
          <p className="mb-6 text-gray-600">{accessResult.message}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!wrappedData) {
    return <WrappedError message={t("wrapped.loadError")} />;
  }

  // Success - show wrapped
  return <WrappedContainer data={wrappedData} />;
}
