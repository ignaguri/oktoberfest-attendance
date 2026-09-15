import {
  getOtherFestivalGroups,
  useCurrentDate,
  useFestival,
} from "@prostcounter/shared/contexts";
import { useAllUserGroups } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { GroupWithMembers } from "@prostcounter/shared/schemas";
import { useMemo } from "react";

import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/**
 * Shown when the current festival has no groups but a live or upcoming one
 * does, which usually means the user is looking at the wrong festival.
 * Reads from the API rather than SQLite, so offline it renders nothing.
 */
export function OtherFestivalGroupsHint() {
  const { t } = useTranslation();
  const { currentFestival, festivals, setCurrentFestival } = useFestival();
  const { data } = useAllUserGroups();
  // Refreshing, so a festival that ends while this stays open drops out
  const now = useCurrentDate();

  const otherFestivalGroups = useMemo(
    () =>
      getOtherFestivalGroups(
        (data as GroupWithMembers[] | null) ?? [],
        festivals,
        currentFestival?.id,
        now,
      ),
    [data, festivals, currentFestival?.id, now],
  );

  if (otherFestivalGroups.length === 0) {
    return null;
  }

  return (
    <VStack space="sm" className="w-full">
      {otherFestivalGroups.map(({ festival, groupCount }) => {
        const hint = t("festival.otherFestivalGroups.hint", {
          count: groupCount,
          festival: festival.name,
        });
        const action = t("festival.switchPrompt.switch", { festival: festival.name });

        return (
          <VStack
            key={festival.id}
            space="sm"
            className="rounded-lg border border-primary-200 bg-primary-50 p-3"
          >
            <Text className="text-center font-medium text-typography-700">{hint}</Text>
            <Button
              action="primary"
              variant="outline"
              onPress={() => setCurrentFestival(festival)}
              accessibilityLabel={action}
              accessibilityHint={hint}
            >
              <ButtonText>{action}</ButtonText>
            </Button>
          </VStack>
        );
      })}
    </VStack>
  );
}

OtherFestivalGroupsHint.displayName = "OtherFestivalGroupsHint";
