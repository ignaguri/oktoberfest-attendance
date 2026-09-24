"use client";

import { useAdminFeedback } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { FEEDBACK_FACES, type FeedbackKind } from "@prostcounter/shared/schemas";
import { formatRelativeTime } from "@prostcounter/shared/utils";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FeedbackFilter = "all" | FeedbackKind;

const FILTERS: FeedbackFilter[] = ["all", "day", "bug", "idea"];

export default function FeedbackList() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FeedbackFilter>("all");
  const { items, isLoading, error } = useAdminFeedback(filter === "all" ? undefined : filter);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 text-left">
      <div className="flex gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={filter === option ? "default" : "outline"}
            onClick={() => setFilter(option)}
          >
            {t(`admin.feedback.filters.${option}`)}
          </Button>
        ))}
      </div>

      {error && <p className="text-red-600">{t("admin.feedback.error")}</p>}
      {isLoading && <p className="text-gray-500">{t("admin.feedback.loading")}</p>}
      {!isLoading && !error && items.length === 0 && (
        <p className="text-gray-500">{t("admin.feedback.empty")}</p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const face = FEEDBACK_FACES.find((entry) => entry.rating === item.rating);
          return (
            <li key={item.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  {face && (
                    <span className="text-2xl" aria-label={t(face.labelKey)}>
                      {face.emoji}
                    </span>
                  )}
                  {t(`admin.feedback.kinds.${item.kind}`)}
                </span>
                <span className="text-xs text-gray-400">
                  {formatRelativeTime(new Date(item.createdAt))}
                </span>
              </div>
              <p className={cn("whitespace-pre-wrap", !item.message && "text-gray-400")}>
                {item.message ?? t("admin.feedback.noMessage")}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {[
                  item.user.username ?? item.user.fullName ?? item.user.id,
                  item.festivalName,
                  item.day,
                  item.platform,
                  item.appVersion,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
