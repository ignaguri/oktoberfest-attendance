"use client";

import { getOtherFestivalGroups, useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { GroupWithMembers } from "@prostcounter/shared/schemas";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useAllUserGroups } from "@/lib/data";

/**
 * Shown when the current festival has no groups but a live or upcoming one
 * does, which usually means the user is looking at the wrong festival.
 */
export function OtherFestivalGroupsHint() {
  const { t } = useTranslation();
  const { currentFestival, festivals, setCurrentFestival } = useFestival();
  const { data } = useAllUserGroups();

  const otherFestivalGroups = useMemo(
    () =>
      getOtherFestivalGroups(
        (data as GroupWithMembers[] | null) ?? [],
        festivals,
        currentFestival?.id,
      ),
    [data, festivals, currentFestival?.id],
  );

  if (otherFestivalGroups.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 flex flex-col gap-2">
      {otherFestivalGroups.map(({ festival, groupCount }) => (
        <li
          key={festival.id}
          className="flex items-center justify-between gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-left"
        >
          <p className="text-sm">
            {t("festival.otherFestivalGroups.hint", {
              count: groupCount,
              festival: festival.name,
            })}
          </p>
          <Button variant="yellow" size="sm" onClick={() => setCurrentFestival(festival)}>
            {t("festival.switchPrompt.switch", { festival: festival.name })}
          </Button>
        </li>
      ))}
    </ul>
  );
}
