import { useFestival } from "@prostcounter/shared/contexts";
import { useProfileDetail, useProfileFestivalDays } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { ProfileDayRow, ProfileDetail, ProfileHistoryRow } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { getInitials } from "@prostcounter/ui";
import { parseISO } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Beer,
  Calendar,
  ChevronDown,
  ChevronRight,
  Tent,
  TrendingUp,
  Users,
} from "lucide-react-native";
import { useState } from "react";

import { AvatarViewerModal } from "@/components/shared/avatar-viewer-modal";
import { MobileFriendshipBadge } from "@/components/shared/user-profile-modal";
import { Avatar, AvatarFallbackText, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

function FestivalHistoryRow({ row, userId }: { row: ProfileHistoryRow; userId: string }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const daysQuery = useProfileFestivalDays(userId, row.festivalId, { enabled: isExpanded });
  // The shared ApiClient type is `any` to avoid a cyclic dependency, so the
  // hooks hand back `any`. Annotate here to get real checking on the page.
  const days: ProfileDayRow[] | null = daysQuery.data;
  const loading: boolean = daysQuery.loading;

  return (
    <View className="border-t border-gray-100 py-3">
      <Pressable
        onPress={() => setIsExpanded((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={row.festivalName}
        accessibilityHint={t("profile.page.historyRowHint")}
      >
        <HStack className="items-center justify-between">
          <VStack space="xs" className="flex-1">
            <Text className="font-medium text-typography-900">{row.festivalName}</Text>
            <Text className="text-xs text-typography-500">
              {t("profile.page.days", { count: row.daysAttended })}
              {" · "}
              {t("profile.page.drinks", { count: row.totalBeers })}
            </Text>
          </VStack>
          {isExpanded ? (
            <ChevronDown size={18} color={IconColors.muted} />
          ) : (
            <ChevronRight size={18} color={IconColors.muted} />
          )}
        </HStack>
      </Pressable>

      {isExpanded && (
        <VStack space="xs" className="mt-2 pl-2">
          {loading && <Spinner size="small" color={Colors.primary[500]} />}
          {(days ?? []).map((day) => (
            <HStack key={day.date} space="sm" className="items-center">
              <Text className="text-sm text-typography-700">
                {formatLocalized(parseISO(day.date), "MMM d")}
              </Text>
              <Text className="text-sm text-typography-500">
                {t("profile.page.drinks", { count: day.totalDrinks })}
              </Text>
              {day.tents.length > 0 && (
                <Text className="flex-1 text-xs text-typography-400">{day.tents.join(", ")}</Text>
              )}
            </HStack>
          ))}
        </VStack>
      )}
    </View>
  );
}

export default function UserProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentFestival } = useFestival();
  const profileQuery = useProfileDetail(id, currentFestival?.id);
  // See the note in FestivalHistoryRow: the shared hooks return `any`.
  const profile: ProfileDetail | null = profileQuery.data;
  const loading: boolean = profileQuery.loading;
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-center text-typography-500">{t("profile.page.notFound")}</Text>
      </View>
    );
  }

  const displayName = profile.fullName || profile.username || "User";
  const fullSizeAvatarUrl = profile.avatarUrl ? getAvatarUrl(profile.avatarUrl) : null;

  return (
    <>
      <ScrollView className="flex-1 bg-background-50">
        <VStack space="md" className="p-4">
          <VStack space="sm" className="items-center">
            <Pressable
              onPress={fullSizeAvatarUrl ? () => setIsAvatarViewerOpen(true) : undefined}
              disabled={!fullSizeAvatarUrl}
              accessibilityRole={fullSizeAvatarUrl ? "button" : undefined}
              accessibilityLabel={fullSizeAvatarUrl ? t("profile.avatar.viewFullSize") : undefined}
              accessibilityHint={
                fullSizeAvatarUrl ? t("profile.avatar.viewFullSizeHint") : undefined
              }
            >
              <Avatar size="xl">
                {fullSizeAvatarUrl ? (
                  <AvatarImage source={{ uri: fullSizeAvatarUrl }} alt={displayName} />
                ) : (
                  <AvatarFallbackText>
                    {getInitials({ fullName: profile.fullName, username: profile.username })}
                  </AvatarFallbackText>
                )}
              </Avatar>
            </Pressable>

            {profile.username && (
              <Text className="text-lg font-semibold text-typography-900">{profile.username}</Text>
            )}
            {profile.fullName && (
              <Text className="text-sm text-typography-500">{profile.fullName}</Text>
            )}
            {profile.friendsSince && (
              <Text className="text-xs text-typography-400">
                {t("friends.friendsSince", {
                  date: formatLocalized(parseISO(profile.friendsSince), "MMM d, yyyy"),
                })}
              </Text>
            )}
            {profile.friendshipStatus && profile.friendshipStatus !== "self" && (
              <MobileFriendshipBadge status={profile.friendshipStatus} userId={id} />
            )}
          </VStack>

          {profile.sharedGroups.length > 0 && (
            <Card variant="outline" size="md" className="bg-white">
              <VStack space="sm">
                <HStack space="xs" className="items-center">
                  <Users size={14} color={IconColors.muted} />
                  <Text className="text-sm font-semibold text-typography-700">
                    {t("profile.page.sharedGroups")}
                  </Text>
                </HStack>
                {profile.sharedGroups.map((group) => (
                  <Pressable
                    key={group.id}
                    onPress={() => router.push(`/group-detail/${group.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={group.name}
                    accessibilityHint={t("profile.page.sharedGroupHint")}
                  >
                    <Text className="text-sm text-primary-600">{group.name}</Text>
                  </Pressable>
                ))}
              </VStack>
            </Card>
          )}

          {profile.stats && (
            <Card variant="outline" size="md" className="bg-white">
              <HStack space="lg" className="justify-center">
                <VStack className="items-center">
                  <HStack space="xs" className="items-center">
                    <Calendar size={16} color={IconColors.muted} />
                    <Text className="text-xl font-bold text-typography-900">
                      {profile.stats.daysAttended}
                    </Text>
                  </HStack>
                  <Text className="text-xs text-typography-500">{t("leaderboard.stats.days")}</Text>
                </VStack>
                <VStack className="items-center">
                  <HStack space="xs" className="items-center">
                    <Beer size={16} color={IconColors.muted} />
                    <Text className="text-xl font-bold text-typography-900">
                      {profile.stats.totalBeers}
                    </Text>
                  </HStack>
                  <Text className="text-xs text-typography-500">
                    {t("leaderboard.stats.drinks")}
                  </Text>
                </VStack>
                <VStack className="items-center">
                  <HStack space="xs" className="items-center">
                    <TrendingUp size={16} color={IconColors.muted} />
                    <Text className="text-xl font-bold text-typography-900">
                      {profile.stats.avgBeers.toFixed(1)}
                    </Text>
                  </HStack>
                  <Text className="text-xs text-typography-500">{t("leaderboard.stats.avg")}</Text>
                </VStack>
              </HStack>
            </Card>
          )}

          {profile.favouriteTent && (
            <Card variant="outline" size="md" className="bg-white">
              <HStack space="sm" className="items-center">
                <Tent size={16} color={IconColors.muted} />
                <VStack>
                  <Text className="text-sm font-semibold text-typography-700">
                    {t("profile.page.favouriteTent")}
                  </Text>
                  <Text className="text-sm text-typography-900">{profile.favouriteTent.name}</Text>
                  <Text className="text-xs text-typography-500">
                    {t("profile.page.favouriteTentVisits", {
                      count: profile.favouriteTent.visits,
                    })}
                  </Text>
                </VStack>
              </HStack>
            </Card>
          )}

          {profile.history.length > 0 && (
            <Card variant="outline" size="md" className="bg-white">
              <VStack>
                <Text className="text-sm font-semibold text-typography-700">
                  {t("profile.page.history")}
                </Text>
                {profile.history.map((row) => (
                  <FestivalHistoryRow key={row.festivalId} row={row} userId={id} />
                ))}
              </VStack>
            </Card>
          )}
        </VStack>
      </ScrollView>

      {fullSizeAvatarUrl && (
        <AvatarViewerModal
          visible={isAvatarViewerOpen}
          imageUrl={fullSizeAvatarUrl}
          name={displayName}
          onClose={() => setIsAvatarViewerOpen(false)}
        />
      )}
    </>
  );
}
