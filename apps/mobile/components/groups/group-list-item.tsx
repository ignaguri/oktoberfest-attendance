import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Users, ChevronRight } from "lucide-react-native";

import type { GroupWithMembers } from "@prostcounter/shared/schemas";

interface GroupListItemProps {
  group: GroupWithMembers;
  onPress: (groupId: string) => void;
}

export function GroupListItem({ group, onPress }: GroupListItemProps) {
  const { t } = useTranslation();

  return (
    <Pressable onPress={() => onPress(group.id)}>
      <Card variant="outline" size="md" className="bg-white">
        <HStack className="items-center justify-between">
          <VStack space="xs" className="flex-1">
            <Text className="text-typography-900 text-lg font-semibold">
              {group.name}
            </Text>
            <HStack space="xs" className="items-center">
              <Users size={14} color={IconColors.muted} />
              <Text className="text-typography-500 text-sm">
                {t("groups.memberCount", {
                  count: group.memberCount,
                })}
              </Text>
            </HStack>
          </VStack>
          <ChevronRight size={20} color={IconColors.muted} />
        </HStack>
      </Card>
    </Pressable>
  );
}

GroupListItem.displayName = "GroupListItem";
