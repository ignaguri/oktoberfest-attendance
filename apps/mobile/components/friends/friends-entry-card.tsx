import { useFriendRequestCount } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { Users } from "lucide-react-native";

import { Badge, BadgeText } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { IconColors } from "@/lib/constants/colors";

/**
 * Entry point to the friends screen, with the pending request count.
 * Pending requests open straight onto the requests tab.
 */
export function FriendsEntryCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: friendRequestCount } = useFriendRequestCount();

  const hasPendingRequests = friendRequestCount != null && friendRequestCount > 0;

  return (
    <Pressable
      onPress={() => router.push(hasPendingRequests ? "/friends?tab=requests" : "/friends")}
      accessibilityRole="button"
      accessibilityLabel={
        hasPendingRequests
          ? t("friends.requestsCount", { count: friendRequestCount })
          : t("friends.title")
      }
      accessibilityHint={t("friends.entryHint")}
    >
      <Card size="md" variant="elevated">
        <HStack className="items-center justify-between">
          <HStack space="md" className="items-center">
            <Users size={22} color={IconColors.primary} />
            <Text className="text-lg font-semibold">{t("friends.title")}</Text>
          </HStack>
          <HStack space="sm" className="items-center">
            {hasPendingRequests && (
              <Badge action="error" variant="solid" className="rounded-full">
                <BadgeText>{friendRequestCount}</BadgeText>
              </Badge>
            )}
            <Text className="text-typography-400">›</Text>
          </HStack>
        </HStack>
      </Card>
    </Pressable>
  );
}
