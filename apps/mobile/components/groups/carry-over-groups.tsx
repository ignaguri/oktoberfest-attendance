import { useFestival } from "@prostcounter/shared/contexts";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { useCarryOverCandidates, useCarryOverGroup } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { CarryOverCandidate } from "@prostcounter/shared/schemas";
import { formatDateForDatabase } from "@prostcounter/shared/utils";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { isCarryOverCollapsed, setCarryOverCollapsed } from "@/lib/groups/carry-over-collapse";

interface CarryOverGroupsProps {
  onSuccess: (groupName: string) => void | Promise<void>;
  /** Receives an already-translated message; the codes are only meaningful here. */
  onError: (message: string) => void | Promise<void>;
}

export function CarryOverGroups({ onSuccess, onError }: CarryOverGroupsProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const festivalId = currentFestival?.id;

  useEffect(() => {
    if (!festivalId) {
      return;
    }
    let isCurrent = true;
    isCarryOverCollapsed(festivalId).then((collapsed) => {
      if (isCurrent) {
        setIsCollapsed(collapsed);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [festivalId]);

  // The shared useQuery wrapper returns `data: query.data ?? null`, so a
  // destructuring default never fires and this is null while disabled.
  const { data, loading } = useCarryOverCandidates(currentFestival?.id);
  const candidates: CarryOverCandidate[] = data ?? [];
  const { mutateAsync: carryOverGroup } = useCarryOverGroup();

  // festivals.status and is_active are stale in prod, so gate on the date.
  // Resolved in the festival's own timezone to match the server guard: endDate is
  // a wall-clock date there, and a UTC date disagrees with it on the last day.
  const festivalHasEnded = currentFestival
    ? currentFestival.endDate <
      formatDateForDatabase(new Date(), currentFestival.timezone ?? undefined)
    : true;

  if (!currentFestival || loading || festivalHasEnded || candidates.length === 0) {
    return null;
  }

  const toggleCollapsed = () => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);
    void setCarryOverCollapsed(currentFestival.id, nextCollapsed);
  };

  const handleCarryOver = async (candidate: CarryOverCandidate) => {
    setPendingGroupId(candidate.groupId);

    try {
      await carryOverGroup({
        groupId: candidate.groupId,
        targetFestivalId: currentFestival.id,
      });
      await onSuccess(candidate.name);
    } catch (error) {
      // mutateAsync rejects, so without this the tap fails silently and the
      // rejection escapes onPress unhandled. ApiError carries the server's error
      // code; the message is human text not meant for display.
      const code = (error as { code?: string })?.code;
      await onError(
        code === ErrorCodes.GROUP_NAME_TAKEN
          ? t("groups.carryOver.errorNameTaken", { name: candidate.name })
          : t("groups.carryOver.errorGeneric"),
      );
    } finally {
      setPendingGroupId(null);
    }
  };

  return (
    <VStack space="sm" className="m-4 mb-0 rounded-lg border border-gray-200 p-4">
      <Pressable
        onPress={toggleCollapsed}
        accessibilityRole="button"
        accessibilityLabel={t("groups.carryOver.toggleLabel")}
        accessibilityHint={t("groups.carryOver.toggleHint")}
        accessibilityState={{ expanded: !isCollapsed }}
      >
        <HStack space="sm" className="items-center justify-between">
          <Heading size="sm" className="flex-1">
            {t("groups.carryOver.title", { festival: currentFestival.name })}
          </Heading>
          {isCollapsed ? (
            <ChevronDown size={16} color={IconColors.muted} />
          ) : (
            <ChevronUp size={16} color={IconColors.muted} />
          )}
        </HStack>
      </Pressable>
      {!isCollapsed && (
        <Text size="sm" className="text-gray-500">
          {t("groups.carryOver.description")}
        </Text>
      )}
      {!isCollapsed &&
        candidates.map((candidate) => (
          <View key={candidate.groupId} className="border-t border-gray-100 pt-3">
            <VStack space="xs">
              <Text className="font-medium">{candidate.name}</Text>
              <Text size="xs" className="text-gray-500">
                {t("groups.carryOver.fromFestival", { festival: candidate.sourceFestivalName })}
                {" · "}
                {t("groups.memberCount", { count: candidate.memberCount })}
              </Text>
              <Button
                size="sm"
                isDisabled={pendingGroupId !== null}
                onPress={() => handleCarryOver(candidate)}
                accessibilityLabel={t("groups.carryOver.action", {
                  festival: currentFestival.name,
                })}
                accessibilityHint={t("groups.carryOver.description")}
              >
                <ButtonText>
                  {pendingGroupId === candidate.groupId
                    ? t("groups.carryOver.pending")
                    : t("groups.carryOver.action", { festival: currentFestival.name })}
                </ButtonText>
              </Button>
            </VStack>
          </View>
        ))}
    </VStack>
  );
}
