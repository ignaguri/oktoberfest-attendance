import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsMember } from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";

import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

interface MemberListProps {
  members: readonly AnalyticsMember[];
  /** Pooled scorecard: label each row with its festival. */
  showFestival: boolean;
  onOpen: (userId: string) => void;
}

export function MemberList({ members, showFestival, onOpen }: MemberListProps) {
  const { t } = useTranslation();

  return (
    <VStack className="rounded-lg border border-outline-200 bg-background-0">
      {members.map((member, index) => {
        const name = member.fullName ?? member.username ?? t("admin.analytics.members.noName");
        const details = [
          member.signedUpAt
            ? t("admin.analytics.members.signedUp", { date: member.signedUpAt.slice(0, 10) })
            : null,
          member.lastActiveDay
            ? t("admin.analytics.members.lastActive", { date: member.lastActiveDay })
            : t("admin.analytics.members.neverActive"),
          showFestival ? (member.festivalName ?? null) : null,
        ].filter((detail): detail is string => detail !== null);
        return (
          <Pressable
            key={`${member.userId}-${member.festivalId ?? ""}`}
            onPress={() => onOpen(member.userId)}
            accessibilityRole="button"
            accessibilityLabel={name}
            accessibilityHint={t("admin.analytics.members.openHint")}
            className={cn("px-3 py-2.5", index > 0 && "border-t border-outline-100")}
          >
            <Text className="text-typography-900">
              {name}
              {/* The handle adds nothing when it is already the displayed name */}
              {member.fullName && member.username && member.username !== member.fullName ? (
                <Text className="text-typography-500">{`  @${member.username}`}</Text>
              ) : null}
            </Text>
            <Text className="text-sm text-typography-500">{details.join(" · ")}</Text>
          </Pressable>
        );
      })}
    </VStack>
  );
}
