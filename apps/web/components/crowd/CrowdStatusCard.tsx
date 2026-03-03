"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useTentCrowdStatus } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { TentCrowdStatus } from "@prostcounter/shared/schemas";
import { Megaphone, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CrowdReportDialog } from "./CrowdReportDialog";

const CROWD_LEVEL_DOT: Record<string, string> = {
  empty: "bg-green-500",
  moderate: "bg-yellow-500",
  crowded: "bg-orange-500",
  full: "bg-red-500",
};

const CROWD_LEVEL_BG: Record<string, string> = {
  empty: "bg-green-100 text-green-700",
  moderate: "bg-yellow-100 text-yellow-700",
  crowded: "bg-orange-100 text-orange-700",
  full: "bg-red-100 text-red-700",
};

export function CrowdStatusCard() {
  const { t } = useTranslation();
  const { currentFestival, isLoading: festivalLoading } = useFestival();
  const festivalId = currentFestival?.id;
  const { crowdStatuses, isLoading } = useTentCrowdStatus(festivalId);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const tentsWithReports = useMemo(() => {
    const crowdOrder: Record<string, number> = {
      empty: 0,
      moderate: 1,
      crowded: 2,
      full: 3,
    };
    return (crowdStatuses as TentCrowdStatus[])
      .filter((s) => s.reportCount > 0 && s.crowdLevel)
      .sort(
        (a, b) =>
          (crowdOrder[a.crowdLevel!] ?? 99) - (crowdOrder[b.crowdLevel!] ?? 99),
      );
  }, [crowdStatuses]);

  if (festivalLoading || isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!festivalId) return null;

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="size-4" />
            {t("crowdReport.currentLevels")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {tentsWithReports.length === 0 ? (
              <p className="text-sm text-gray-500">
                {t("crowdReport.noReports")}
              </p>
            ) : (
              <>
                {tentsWithReports.slice(0, 5).map((tent) => (
                  <div
                    key={tent.tentId}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5"
                  >
                    <span className="text-sm text-gray-700">
                      {tent.tentName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          CROWD_LEVEL_BG[tent.crowdLevel!],
                        )}
                      >
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            CROWD_LEVEL_DOT[tent.crowdLevel!],
                          )}
                        />
                        {t(`crowdReport.levels.${tent.crowdLevel}`)}
                      </span>
                      {tent.avgWaitMinutes != null &&
                        tent.avgWaitMinutes > 0 && (
                          <span className="text-xs text-gray-500">
                            {t("crowdReport.waitTime", {
                              minutes: tent.avgWaitMinutes,
                            })}
                          </span>
                        )}
                    </div>
                  </div>
                ))}
                {tentsWithReports.length > 5 && (
                  <p className="text-center text-xs text-gray-400">
                    {t("crowdReport.moreTents", {
                      count: tentsWithReports.length - 5,
                    })}
                  </p>
                )}
              </>
            )}

            <Button
              variant="outline"
              className="mt-1 w-full"
              onClick={() => setReportDialogOpen(true)}
            >
              <Megaphone className="mr-2 size-4" />
              {t("crowdReport.reportCrowd")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <CrowdReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
      />
    </>
  );
}
