import { useTranslation } from "@prostcounter/shared/i18n";
import type { AdminUserGroup } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { ChevronRight } from "lucide-react-native";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface UserGroupsListProps {
  groups: AdminUserGroup[];
  isLoading: boolean;
  onOpen: (groupId: string) => void;
}

/**
 * The groups this user belongs to, each row opening that group's screen.
 *
 * The festival is shown beside the group name because a group carried over to a
 * new festival keeps its name, so two rows can otherwise read identically.
 */
export function UserGroupsList({ groups, isLoading, onOpen }: UserGroupsListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <Text className="text-typography-500">{t("admin.mobile.userDetail.loading")}</Text>;
  }

  if (groups.length === 0) {
    return <Text className="text-typography-500">{t("admin.mobile.userDetail.noGroups")}</Text>;
  }

  return (
    <VStack>
      {groups.map((group, index) => (
        <Pressable
          key={group.id}
          className={cn("py-3", index < groups.length - 1 && "border-b border-outline-100")}
          onPress={() => onOpen(group.id)}
          accessibilityRole="button"
          accessibilityLabel={group.name}
          accessibilityHint={t("admin.mobile.userDetail.groupOpenHint")}
        >
          <HStack className="items-center justify-between">
            <VStack className="flex-1">
              <Text className="text-typography-900">{group.name}</Text>
              <Text className="text-sm text-typography-500">
                {group.joined_at
                  ? t("admin.mobile.userDetail.groupSummary", {
                      festival: group.festival_name,
                      date: formatLocalized(new Date(group.joined_at), "PP"),
                    })
                  : group.festival_name}
              </Text>
            </VStack>
            <ChevronRight size={18} color={IconColors.muted} />
          </HStack>
        </Pressable>
      ))}
    </VStack>
  );
}
