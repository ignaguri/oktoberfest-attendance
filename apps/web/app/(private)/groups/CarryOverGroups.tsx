"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { ErrorCodes } from "@prostcounter/shared/errors";
import type { CarryOverCandidate } from "@prostcounter/shared/schemas";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCarryOverCandidates, useCarryOverGroup } from "@/lib/data";
import { useTranslation } from "@/lib/i18n/client";

export default function CarryOverGroups() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  // The shared useQuery wrapper returns `data: query.data ?? null`, so a
  // destructuring default never fires and this is null while disabled.
  const { data, loading } = useCarryOverCandidates(currentFestival?.id);
  const candidates: CarryOverCandidate[] = data ?? [];
  const { mutateAsync: carryOverGroup } = useCarryOverGroup();

  // festivals.status and is_active are stale in prod, so gate on the date.
  const festivalHasEnded = currentFestival
    ? currentFestival.endDate < new Date().toISOString().slice(0, 10)
    : true;

  if (!currentFestival || loading || festivalHasEnded || candidates.length === 0) {
    return null;
  }

  const handleCarryOver = async (candidate: CarryOverCandidate) => {
    setPendingGroupId(candidate.groupId);

    try {
      await carryOverGroup({
        groupId: candidate.groupId,
        targetFestivalId: currentFestival.id,
      });
      toast.success(
        t("groups.carryOver.success", {
          name: candidate.name,
          festival: currentFestival.name,
        }),
      );
    } catch (error) {
      // ApiError carries the server's error code; the message is human text.
      const code = (error as { code?: string })?.code;
      toast.error(
        code === ErrorCodes.GROUP_NAME_TAKEN
          ? t("groups.carryOver.errorNameTaken", { name: candidate.name })
          : t("groups.carryOver.errorGeneric"),
      );
    } finally {
      setPendingGroupId(null);
    }
  };

  // The card lives inside the component, not on the page: this returns null
  // whenever there is nothing to offer, and a wrapper on the page would leave
  // an empty card behind for every user without candidates.
  return (
    <section className="card">
      <h2 className="mb-1 text-xl font-bold">
        {t("groups.carryOver.title", { festival: currentFestival.name })}
      </h2>
      <p className="mb-3 text-sm text-gray-500">{t("groups.carryOver.description")}</p>
      <ul className="flex flex-col gap-2">
        {candidates.map((candidate) => (
          <li
            key={candidate.groupId}
            className="flex items-center justify-between gap-2 rounded-md border p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{candidate.name}</p>
              <p className="text-xs text-gray-500">
                {t("groups.carryOver.fromFestival", {
                  festival: candidate.sourceFestivalName,
                })}
                {" · "}
                {t("groups.memberCount", { count: candidate.memberCount })}
              </p>
            </div>
            <Button
              variant="yellow"
              size="sm"
              disabled={pendingGroupId !== null}
              onClick={() => handleCarryOver(candidate)}
            >
              {pendingGroupId === candidate.groupId
                ? t("groups.carryOver.pending")
                : t("groups.carryOver.action", { festival: currentFestival.name })}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
