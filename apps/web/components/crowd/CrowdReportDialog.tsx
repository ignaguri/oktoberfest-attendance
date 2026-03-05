"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import {
  useSubmitCrowdReport,
  useTentCrowdReports,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { CrowdLevel } from "@prostcounter/shared/schemas";
import { AlertCircle, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { SingleSelect } from "@/components/Select/SingleSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTents } from "@/hooks/use-tents";
import { cn } from "@/lib/utils";

const CROWD_LEVELS: CrowdLevel[] = ["empty", "moderate", "crowded", "full"];

const CROWD_LEVEL_COLORS: Record<CrowdLevel, string> = {
  empty: "bg-green-500",
  moderate: "bg-yellow-500",
  crowded: "bg-orange-500",
  full: "bg-red-500",
};

const CROWD_LEVEL_SELECTED_BG: Record<CrowdLevel, string> = {
  empty: "border-green-500 bg-green-50",
  moderate: "border-yellow-500 bg-yellow-50",
  crowded: "border-orange-500 bg-orange-50",
  full: "border-red-500 bg-red-50",
};

const WAIT_TIME_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

/**
 * Calculate minutes since the most recent report.
 * Returns null if no reports or if the most recent report is older than 5 minutes.
 * Extracted as a pure function to satisfy React compiler purity rules.
 */
function getMinutesSinceLastReport(
  reports: ReadonlyArray<{ createdAt: string }>,
  now: number,
): number | null {
  if (reports.length === 0) return null;
  const reportTime = new Date(reports[0].createdAt).getTime();
  const diffMinutes = Math.floor((now - reportTime) / 60000);
  return diffMinutes <= 5 ? diffMinutes : null;
}

interface CrowdReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected tent ID (when opened from a specific tent row) */
  preselectedTentId?: string;
}

export function CrowdReportDialog({
  open,
  onOpenChange,
  preselectedTentId,
}: CrowdReportDialogProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const festivalId = currentFestival?.id;

  const { tents } = useTents(festivalId);
  const { submitReport, isSubmitting, error, reset } = useSubmitCrowdReport();

  const [selectedTentId, setSelectedTentId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<CrowdLevel | null>(null);
  const [waitTimeMinutes, setWaitTimeMinutes] = useState<number | undefined>(
    undefined,
  );

  // Sync preselectedTentId into state when the dialog opens. The dialog is
  // always mounted (just hidden), so useState only runs once — prop changes
  // after mount don't update state without this effect.
  useEffect(() => {
    if (open && preselectedTentId) {
      setSelectedTentId(preselectedTentId);
    }
  }, [open, preselectedTentId]);

  // Check rate limit for selected tent
  const { reports } = useTentCrowdReports(
    selectedTentId ?? undefined,
    festivalId,
  );

  // eslint-disable-next-line react-hooks/purity -- Date.now() is intentionally impure; we want the current time each render
  const minutesSinceLastReport = getMinutesSinceLastReport(reports, Date.now());

  const handleSubmit = useCallback(async () => {
    if (!selectedTentId || !selectedLevel || !festivalId) return;

    try {
      await submitReport({
        tentId: selectedTentId,
        festivalId,
        crowdLevel: selectedLevel,
        waitTimeMinutes,
      });
      toast.success(t("crowdReport.success"));
      setSelectedTentId(null);
      setSelectedLevel(null);
      setWaitTimeMinutes(undefined);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("5 minutes")) {
        toast.error(t("crowdReport.error"));
      }
    }
  }, [
    selectedTentId,
    selectedLevel,
    festivalId,
    waitTimeMinutes,
    submitReport,
    onOpenChange,
    t,
  ]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setSelectedTentId(null);
        setSelectedLevel(null);
        setWaitTimeMinutes(undefined);
        reset();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, reset],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("crowdReport.reportCrowd")}</DialogTitle>
          <DialogDescription>{t("crowdReport.selectLevel")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Tent Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              {t("attendance.tent.selectTents")}
            </label>
            <SingleSelect
              options={tents.map((group) => ({
                title: group.category,
                options: group.options,
              }))}
              placeholder={t("attendance.tent.selectTents")}
              value={selectedTentId}
              onSelect={(option) => setSelectedTentId(option.value)}
              onUnselect={() => setSelectedTentId(null)}
            />
          </div>

          {/* Rate-limit notice */}
          {minutesSinceLastReport != null && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2">
              <AlertCircle className="size-4 text-yellow-600" />
              <span className="text-sm text-yellow-700">
                {t("crowdReport.recentReport", {
                  minutes: minutesSinceLastReport,
                })}
              </span>
            </div>
          )}

          {/* Crowd Level Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              {t("crowdReport.selectLevel")}
            </label>
            <div
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-label={t("crowdReport.selectLevel")}
            >
              {CROWD_LEVELS.map((level) => {
                const isSelected = selectedLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedLevel(level)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 transition-colors",
                      isSelected
                        ? CROWD_LEVEL_SELECTED_BG[level]
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                    )}
                  >
                    <span
                      className={cn(
                        "size-3 rounded-full",
                        CROWD_LEVEL_COLORS[level],
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isSelected ? "text-gray-900" : "text-gray-600",
                      )}
                    >
                      {t(`crowdReport.levels.${level}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wait Time */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t("crowdReport.waitTimeLabel")}
              </label>
              <span className="text-xs text-gray-400">
                {t("crowdReport.waitTimeOptional")}
              </span>
            </div>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t("crowdReport.waitTimeLabel")}
            >
              {WAIT_TIME_OPTIONS.map((minutes) => {
                const isSelected = waitTimeMinutes === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      setWaitTimeMinutes(isSelected ? undefined : minutes)
                    }
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      isSelected
                        ? "border-yellow-500 bg-yellow-50 font-medium text-yellow-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100",
                    )}
                  >
                    {minutes}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline error for rate-limit */}
          {error && error.includes("5 minutes") && (
            <p className="text-sm text-red-600">
              {t("crowdReport.rateLimited")}
            </p>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedTentId || !selectedLevel || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t("common.buttons.loading")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="size-4" />
                {t("crowdReport.submitReport")}
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
