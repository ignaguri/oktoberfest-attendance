"use client";

import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchWinningCriterias } from "@/lib/sharedActions";
import { winningCriteriaText } from "@/lib/constants";
import { WinningCriteria } from "@/lib/types";
import { useState, useEffect, useCallback, useMemo } from "react";

import type { Tables } from "@/lib/database.types";

import { fetchGlobalLeaderboard } from "./actions";

export default function GlobalLeaderboardClient() {
  const [winningCriteriaId, setWinningCriteriaId] = useState<number>(1);
  const [winningCriteria, setWinningCriteria] = useState<WinningCriteria>(
    WinningCriteria.days_attended,
  );
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [winningCriterias, setWinningCriterias] = useState<
    Tables<"winning_criteria">[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchLeaderboardData = useCallback(
    async (criteriaId: number) => {
      setIsLoading(true);
      try {
        const data = await fetchGlobalLeaderboard(criteriaId);
        setLeaderboardData(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch leaderboard data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const initializeData = async () => {
      try {
        const criterias = await fetchWinningCriterias();
        setWinningCriterias(criterias);
        if (criterias.length > 0) {
          setWinningCriteriaId(criterias[0].id);
          await fetchLeaderboardData(criterias[0].id);
        }
      } catch (error) {
        toast({
          title: "Error",
          description:
            "Failed to initialize leaderboard data. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    initializeData();
  }, [fetchLeaderboardData, toast]);

  useEffect(() => {
    if (winningCriteriaId) {
      fetchLeaderboardData(winningCriteriaId);
    }
  }, [winningCriteriaId, fetchLeaderboardData]);

  const criteriaOptions = useMemo(
    () =>
      winningCriterias.map((criteria) => ({
        value: criteria.id.toString(),
        label:
          winningCriteriaText[
            criteria.name as keyof typeof winningCriteriaText
          ],
      })),
    [winningCriterias],
  );

  const selectedCriteria = winningCriterias.find(
    (c) => c.id === winningCriteriaId,
  );

  if (isLoading) {
    return <LoadingSpinner />;
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
            setWinningCriteriaId(Number(option.value));
            const criteria = winningCriterias.find(
              (c) => c.id === Number(option.value),
            );
            if (criteria) {
              setWinningCriteria(criteria.name as WinningCriteria);
            }
          }}
          placeholder="Select winning criteria"
        />
      </div>
      {selectedCriteria && leaderboardData.length > 0 && (
        <Leaderboard
          entries={leaderboardData}
          showGroupCount
          winningCriteria={winningCriteria}
        />
      )}
    </div>
  );
}
