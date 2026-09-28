"use client";

import { useTranslation } from "@prostcounter/shared/i18n";

import LoadingSpinner from "@/components/LoadingSpinner";

export function WrappedLoading() {
  const { t } = useTranslation();
  return (
    <div className="wrapped-paper flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size={48} />
        <p className="text-xl font-semibold text-wrapped-ink">{t("wrapped.loading")}</p>
      </div>
    </div>
  );
}

export function WrappedError({ title, message }: { title?: string; message?: string }) {
  const { t } = useTranslation();
  return (
    <div className="wrapped-paper flex h-screen items-center justify-center">
      <div className="max-w-md px-6 text-center">
        <h2 className="mb-2 font-wrapped text-3xl font-extrabold text-wrapped-ink">{title ?? t("wrapped.errorTitle")}</h2>
        <p className="text-wrapped-ink/70">{message ?? t("wrapped.error")}</p>
      </div>
    </div>
  );
}
