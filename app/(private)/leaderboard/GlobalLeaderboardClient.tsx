"use client";

import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Label } from "@/components/ui/label";
import { useFestival } from "@/contexts/FestivalContext";
import { winningCriteriaText } from "@/lib/constants";
import { useGlobalLeaderboard, useWinningCriterias } from "@/lib/data";
import { WinningCriteria } from "@/lib/types";
import { useState, useEffect, useMemo, startTransition } from "react";
import { toast } from "sonner";

export default function GlobalLeaderboardClient() {
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
      toast.error("Failed to load winning criteria. Please refresh the page.");
    }
  }, [criteriasError]);

  useEffect(() => {
    if (leaderboardError) {
      toast.error("Failed to fetch leaderboard data. Please try again.");
    }
  }, [leaderboardError]);

  const criteriaOptions = useMemo(
    () =>
      winningCriterias?.map((criteria) => ({
        value: criteria.id.toString(),
        label:
          winningCriteriaText[
            criteria.name as keyof typeof winningCriteriaText
          ],
      })) || [],
    [winningCriterias],
  );

  const selectedCriteria = winningCriterias?.find(
    (c) => c.id === winningCriteriaId,
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
          Winning Criteria:
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
              (c) => c.id === newCriteriaId,
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
          entries={leaderboardData as any} // TODO: Fix type mismatch between server action return and LeaderboardEntry
          showGroupCount
          winningCriteria={winningCriteria}
        />
      )}
    </div>
  );
}
