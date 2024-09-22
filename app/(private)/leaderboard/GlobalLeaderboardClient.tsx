"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchGlobalLeaderboard, fetchWinningCriterias } from "@/lib/actions";
import { SingleSelect } from "@/components/Select/SingleSelect";
import { Leaderboard } from "@/components/Leaderboard";
import { winningCriteriaText } from "@/lib/constants";
import { Tables } from "@/lib/database.types";
import { WinningCriteria } from "@/lib/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";

export default function GlobalLeaderboardClient() {
  const [winningCriteriaId, setWinningCriteriaId] = useState<number>(1);
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
      <div className="mb-4">
        <SingleSelect
          options={[{ title: "Winning Criteria", options: criteriaOptions }]}
          value={winningCriteriaId.toString()}
          onSelect={(option) => setWinningCriteriaId(Number(option.value))}
          placeholder="Select winning criteria"
        />
      </div>
      {selectedCriteria && leaderboardData.length > 0 && (
        <Leaderboard
          entries={leaderboardData}
          winningCriteria={selectedCriteria.name as WinningCriteria}
          showGroupCount
        />
      )}
    </div>
  );
}
