"use client";

import { useWrappedFestivals } from "@prostcounter/shared/hooks";
import { getWrappedArchiveSummary } from "@prostcounter/shared/utils";
import { ChevronRight, Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";

import { Card } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";

/** One row for every Wrapped, however many festivals: the list lives on /wrapped/archive */
export function WrappedArchive() {
  const { t } = useTranslation();
  const { data: festivals } = useWrappedFestivals();
  const summary = getWrappedArchiveSummary(festivals);

  if (!summary) {
    return null;
  }

  const href =
    summary.target.kind === "festival"
      ? `/wrapped?festivalId=${summary.target.festivalId}`
      : "/wrapped/archive";

  return (
    <Card className="mx-auto mt-6 w-full max-w-lg">
      <Link href={href} className="flex items-center justify-between px-6 py-4 hover:opacity-80">
        <span className="flex items-center gap-3">
          <Sparkles className="size-5 text-yellow-600" />
          <span className="font-semibold">
            {t("profile.wrappedArchive.row", { count: summary.count })}
          </span>
          {summary.newCount > 0 && (
            <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-white">
              {t("profile.wrappedArchive.newCount", { count: summary.newCount })}
            </span>
          )}
        </span>
        <ChevronRight className="size-5 text-gray-400" />
      </Link>
    </Card>
  );
}
