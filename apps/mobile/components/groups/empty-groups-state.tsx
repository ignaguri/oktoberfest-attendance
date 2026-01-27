import { useTranslation } from "@prostcounter/shared/i18n";
import { Plus, UserPlus, Users } from "lucide-react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
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
    <View className="flex-1 px-4 pt-8">
      <Card size="lg" variant="elevated" className="bg-background-0">
        <VStack space="xl" className="items-center py-4">
          <Users size={64} color={IconColors.disabled} />

          <VStack space="sm" className="items-center">
            <Heading size="lg" className="text-center text-typography-900">
              {t("groups.empty.title")}
            </Heading>
            <Text className="text-center text-typography-500">
              {t("groups.empty.description")}
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
                {t("groups.actions.create")}
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
                {t("groups.actions.join")}
              </ButtonText>
            </Button>
          </VStack>
        </VStack>
      </Card>
    </View>
  );
}

EmptyGroupsState.displayName = "EmptyGroupsState";
