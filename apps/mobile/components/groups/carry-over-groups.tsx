import { useFestival } from "@prostcounter/shared/contexts";
import { useCarryOverCandidates, useCarryOverGroup } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { CarryOverCandidate } from "@prostcounter/shared/schemas";
import { useState } from "react";

import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";

interface CarryOverGroupsProps {
  onSuccess: (groupName: string) => void | Promise<void>;
}

export function CarryOverGroups({ onSuccess }: CarryOverGroupsProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  const { data: candidates = [], loading } = useCarryOverCandidates(currentFestival?.id) as {
    data: CarryOverCandidate[];
    loading: boolean;
  };
  const { mutateAsync: carryOverGroup } = useCarryOverGroup();

  // festivals.status and is_active are stale in prod, so gate on the date.
  const festivalHasEnded = currentFestival
    ? currentFestival.endDate < new Date().toISOString().slice(0, 10)
    : true;

  if (loading || festivalHasEnded || candidates.length === 0 || !currentFestival) {
    return null;
  }

  const handleCarryOver = async (candidate: CarryOverCandidate) => {
    setPendingGroupId(candidate.groupId);

    try {
      await carryOverGroup({
        groupId: candidate.groupId,
        targetFestivalId: currentFestival.id,
      });
      await onSuccess(candidate.name);
    } finally {
      setPendingGroupId(null);
    }
  };

  return (
    <VStack space="sm" className="m-4 mb-0 rounded-lg border border-gray-200 p-4">
      <Heading size="sm">{t("groups.carryOver.title", { festival: currentFestival.name })}</Heading>
      <Text size="sm" className="text-gray-500">
        {t("groups.carryOver.description")}
      </Text>
      {candidates.map((candidate) => (
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
