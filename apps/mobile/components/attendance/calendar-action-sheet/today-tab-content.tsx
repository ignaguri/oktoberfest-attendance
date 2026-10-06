import { useTranslation } from "@prostcounter/shared/i18n";
import type { DayPlan, FriendGoing, FriendWent } from "@prostcounter/shared/schemas";
import { useMemo } from "react";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { DayPlanner } from "../day-planner";
import { WhosGoingSection } from "../day-planner/whos-going-section";
import { FriendsWentTabContent } from "./friends-went-tab-content";

interface TodayTabContentProps {
  festivalId: string;
  timezone: string;
  selectedDate: Date;
  existingPlan: DayPlan | null;
  /** False once the day's reservation is checked in or expired. */
  canPlan: boolean;
  plannerKey: string;
  /** Friends with a plan or reservation today. */
  friendsGoing: FriendGoing[];
  /** Friends who logged today so far. Null until loaded. */
  friendsWent: FriendWent[] | null;
  friendsWentLoading: boolean;
  friendsWentError: Error | null;
  /** Nobody logged today and nobody plans to come. */
  nobodyOut: boolean;
  onRetryFriendsWent: () => void;
  onOpenGallery: (groupId: string) => void;
  onPlanSuccess?: () => void;
  onClose: () => void;
}

/**
 * Today: who checked in, who is coming later, and the user's own plan for
 * later. A friend who already logged moves from "coming later" to "checked
 * in".
 */
export function TodayTabContent({
  festivalId,
  timezone,
  selectedDate,
  existingPlan,
  canPlan,
  plannerKey,
  friendsGoing,
  friendsWent,
  friendsWentLoading,
  friendsWentError,
  nobodyOut,
  onRetryFriendsWent,
  onOpenGallery,
  onPlanSuccess,
  onClose,
}: TodayTabContentProps) {
  const { t } = useTranslation();

  const comingLater = useMemo(() => {
    const thereIds = new Set((friendsWent ?? []).map((friend) => friend.userId));
    return friendsGoing.filter((friend) => !thereIds.has(friend.userId));
  }, [friendsGoing, friendsWent]);

  return (
    <VStack space="md">
      <FriendsWentTabContent
        friends={friendsWent}
        isLoading={friendsWentLoading}
        error={friendsWentError}
        onRetry={onRetryFriendsWent}
        onOpenGallery={onOpenGallery}
        title={t("attendance.today.checkedIn")}
        hideWhenEmpty
      />

      {comingLater.length > 0 && (
        <VStack className="px-2 pb-4">
          <WhosGoingSection
            friends={comingLater}
            timezone={timezone}
            title={t("attendance.today.comingLater")}
          />
        </VStack>
      )}

      {nobodyOut && (
        <Text className="px-2 pb-4 text-center text-sm text-typography-500">
          {t("attendance.today.empty")}
        </Text>
      )}

      {canPlan && (
        <DayPlanner
          key={plannerKey}
          festivalId={festivalId}
          timezone={timezone}
          selectedDate={selectedDate}
          existingPlan={existingPlan}
          onSuccess={onPlanSuccess}
          onClose={onClose}
        />
      )}
    </VStack>
  );
}
