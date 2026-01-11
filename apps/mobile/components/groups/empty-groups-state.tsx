import { useTranslation } from "@prostcounter/shared/i18n";
import { Users, UserPlus, Plus } from "lucide-react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

interface EmptyGroupsStateProps {
  onCreateGroup: () => void;
  onJoinGroup: () => void;
}

export function EmptyGroupsState({
  onCreateGroup,
  onJoinGroup,
}: EmptyGroupsStateProps) {
  const { t } = useTranslation();

  return (
    <VStack space="xl" className="flex-1 items-center justify-center px-8">
      <Users size={64} color={IconColors.disabled} />

      <VStack space="sm" className="items-center">
        <Heading size="lg" className="text-center text-typography-900">
          {t("groups.empty.title", { defaultValue: "No Groups Yet" })}
        </Heading>
        <Text className="text-center text-typography-500">
          {t("groups.empty.description", {
            defaultValue:
              "Create a group to compete with friends or join an existing group to start tracking together.",
          })}
        </Text>
      </VStack>

      <VStack space="md" className="w-full">
        <Button
          variant="solid"
          action="primary"
          size="lg"
          className="w-full"
          onPress={onCreateGroup}
        >
          <Plus size={20} color={IconColors.white} />
          <ButtonText className="ml-2">
            {t("groups.actions.create", { defaultValue: "Create Group" })}
          </ButtonText>
        </Button>

        <Button
          variant="outline"
          action="secondary"
          size="lg"
          className="w-full"
          onPress={onJoinGroup}
        >
          <UserPlus size={20} color={IconColors.default} />
          <ButtonText className="ml-2">
            {t("groups.actions.join", { defaultValue: "Join Group" })}
          </ButtonText>
        </Button>
      </VStack>
    </VStack>
  );
}

EmptyGroupsState.displayName = "EmptyGroupsState";
