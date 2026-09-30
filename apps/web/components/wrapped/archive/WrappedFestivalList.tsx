"use client";

import type { WrappedFestival } from "@prostcounter/shared/schemas";
import { ChevronRight, Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";

import { useTranslation } from "@/lib/i18n/client";

export function WrappedFestivalList({ festivals }: { festivals: WrappedFestival[] }) {
  const { t } = useTranslation();

  return (
    <div className="divide-y">
      {festivals.map((festival) => (
        <Link
          key={festival.festivalId}
          href={`/wrapped?festivalId=${festival.festivalId}`}
          className="flex items-center justify-between py-3 hover:opacity-80"
        >
          <span className="flex items-center gap-3">
            <Sparkles className="size-5 text-yellow-600" />
            <span>{festival.name}</span>
            {!festival.viewed && (
              <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-semibold text-white">
                {t("profile.wrappedArchive.new")}
              </span>
            )}
          </span>
          <ChevronRight className="size-5 text-gray-400" />
        </Link>
      ))}
    </div>
  );
}
