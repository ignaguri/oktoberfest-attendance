"use client";

import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Label } from "@/components/ui/label";
import { useFestival } from "@/contexts/FestivalContext";
import { useGlobalLeaderboard, useWinningCriterias } from "@/lib/data";
import { useTranslation } from "@/lib/i18n/client";
import { WinningCriteria } from "@/lib/types";
import { useState, useEffect, useMemo, startTransition } from "react";
import { toast } from "sonner";

import type { WinningCriteriaOption } from "@prostcounter/shared/schemas";

export default function GlobalLeaderboardClient() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const [winningCriteriaId, setWinningCriteriaId] = useState<number>(1);
  const [winningCriteria, setWinningCriteria] = useState<WinningCriteria>(
    WinningCriteria.days_attended,
  );

  // Use our abstraction layer hooks
  const {
    data: winningCriterias,
    loading: criteriasLoading,
    error: criteriasError,
  } = useWinningCriterias();

  const {
    data: leaderboardData,
    loading: leaderboardLoading,
    error: leaderboardError,
  } = useGlobalLeaderboard(winningCriteriaId, currentFestival?.id);

  // Initialize winning criteria ID when data loads
  useEffect(() => {
    if (
      winningCriterias &&
      winningCriterias.length > 0 &&
      winningCriteriaId === 1
    ) {
      startTransition(() => {
        setWinningCriteriaId(winningCriterias[0].id);
      });
    }
  }, [winningCriterias, winningCriteriaId]);

  // Handle errors with toast notifications
  useEffect(() => {
    if (criteriasError) {
      toast.error(t("notifications.error.leaderboardLoadFailed"));
    }
  }, [criteriasError, t]);

  useEffect(() => {
    if (leaderboardError) {
      toast.error(t("notifications.error.leaderboardFetchFailed"));
    }
  }, [leaderboardError, t]);

  const criteriaOptions = useMemo(
    () =>
      winningCriterias?.map((criteria: WinningCriteriaOption) => ({
        value: criteria.id.toString(),
        label: t(`groups.winningCriteria.${criteria.name}`),
      })) || [],
    [winningCriterias, t],
  );

  const selectedCriteria = winningCriterias?.find(
    (c: WinningCriteriaOption) => c.id === winningCriteriaId,
  );

  // Show loading state
  const isLoading = criteriasLoading || leaderboardLoading;
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Don't render if no festival is selected
  if (!currentFestival) {
    return null;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-center gap-2">
        <Label
          htmlFor="winning-criteria-select"
          className="text-sm font-medium text-gray-700"
        >
          {t("groups.create.winningCriteria")}:
        </Label>
        <SingleSelect
          id="winning-criteria-select"
          options={[{ title: "Winning Criteria", options: criteriaOptions }]}
          value={winningCriteriaId.toString()}
          buttonClassName="w-fit"
          onSelect={(option) => {
            const newCriteriaId = Number(option.value);
            setWinningCriteriaId(newCriteriaId);
            const criteria = winningCriterias?.find(
              (c: WinningCriteriaOption) => c.id === newCriteriaId,
            );
            if (criteria) {
              setWinningCriteria(criteria.name as WinningCriteria);
            }
          }}
          placeholder="Select winning criteria"
        />
      </div>
      {selectedCriteria && leaderboardData && leaderboardData.length > 0 && (
        <Leaderboard
          entries={leaderboardData}
          showGroupCount
          winningCriteria={winningCriteria}
          festivalId={currentFestival?.id}
        />
      )}
    </div>
  );
}
