import { getAppUrl } from "@prostcounter/shared";
import { useFestival } from "@prostcounter/shared/contexts";
import {
  useGroupLeaderboard,
  useGroupSettings,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  LeaderboardEntry,
  WinningCriteria,
} from "@prostcounter/shared/schemas";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Image,
  QrCode,
  Settings,
  Share2,
  Trophy,
  Users,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Share } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { QRCodeSheet } from "@/components/groups/qr-code-sheet";
import type { SortOrder } from "@/components/shared/leaderboard";
import { Leaderboard } from "@/components/shared/leaderboard";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  useAlertDialog,
} from "@/components/ui/alert-dialog";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/lib/auth/AuthContext";
import { IconColors } from "@/lib/constants/colors";

// Map winning criteria to numeric ID for the leaderboard hook
const CRITERIA_TO_ID: Record<WinningCriteria, number> = {
  days_attended: 1,
  total_beers: 2,
  avg_beers: 3,
};

const CRITERIA_LABELS: Record<WinningCriteria, string> = {
  days_attended: "groups.criteria.daysAttended",
  total_beers: "groups.criteria.totalBeers",
  avg_beers: "groups.criteria.avgBeers",
};

export default function GroupDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { currentFestival } = useFestival();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  // Fetch group settings
  const {
    data: groupResponse,
    loading: isLoadingGroup,
    error: groupError,
    refetch: refetchGroup,
    isRefetching: isRefetchingGroup,
  } = useGroupSettings(id || "");

  // The group data is nested inside the response
  const group = groupResponse?.data;

  // Fetch leaderboard
  const criteriaId = group
    ? CRITERIA_TO_ID[group.winningCriteria as WinningCriteria]
    : 0;
  const {
    data: leaderboardData,
    loading: isLoadingLeaderboard,
    refetch: refetchLeaderboard,
    isRefetching: isRefetchingLeaderboard,
  } = useGroupLeaderboard(id || "", criteriaId, currentFestival?.id || "");

  const isCreator = user?.id === group?.createdBy;
  const isLoading = isLoadingGroup || isLoadingLeaderboard;
  const isRefetching = isRefetchingGroup || isRefetchingLeaderboard;

  // QR Code sheet state
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);

  // Sorting state for leaderboard
  const [sortColumn, setSortColumn] = useState<WinningCriteria | undefined>(
    undefined,
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Handle share
  const handleShare = useCallback(async () => {
    if (!group?.inviteToken) {
      showDialog(t("common.status.error"), t("groups.share.noToken"));
      return;
    }

    const inviteUrl = `${getAppUrl()}/join-group?token=${group.inviteToken}`;
    const message = t("groups.share.message", {
      name: group.name,
    });

    try {
      await Share.share({
        message: `${message}\n\n${inviteUrl}`,
        url: inviteUrl,
      });
    } catch (error) {
      console.error("Failed to share:", error);
    }
  }, [group, showDialog, t]);

  // Handle settings navigation
  const handleSettings = useCallback(() => {
    router.push(`/groups/${id}/settings`);
  }, [router, id]);

  // Handle QR code
  const handleQRCode = useCallback(() => {
    setIsQRCodeOpen(true);
  }, []);

  // Handle sort change
  const handleSortChange = useCallback(
    (criteria: WinningCriteria, order: SortOrder) => {
      setSortColumn(criteria);
      setSortOrder(order);
    },
    [],
  );

  // Handle gallery navigation
  const handleGallery = useCallback(() => {
    router.push(`/groups/${id}/gallery`);
  }, [router, id]);

  // Handle refresh
  const onRefresh = useCallback(() => {
    refetchGroup();
    refetchLeaderboard();
  }, [refetchGroup, refetchLeaderboard]);

  // Loading state
  if (isLoading && !group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Spinner size="large" />
      </View>
    );
  }

  // Error state
  if (groupError) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <ErrorState error={groupError} onRetry={refetchGroup} />
      </View>
    );
  }

  // No group found
  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50 p-6">
        <Users size={48} color={IconColors.disabled} />
        <Text className="mt-4 text-center text-typography-500">
          {t("groups.detail.notFound")}
        </Text>
        <Button
          variant="outline"
          action="secondary"
          className="mt-4"
          onPress={() => router.back()}
        >
          <ButtonText>{t("common.buttons.goBack")}</ButtonText>
        </Button>
      </View>
    );
  }

  const winningCriteria = group.winningCriteria as WinningCriteria;
  const criteriaLabel = t(CRITERIA_LABELS[winningCriteria]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView
        className="flex-1 bg-background-50"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching ?? false}
            onRefresh={onRefresh}
          />
        }
      >
        <VStack space="lg" className="p-4">
          {/* Group Info Card */}
          <Card variant="elevated" size="lg" className="bg-white">
            <VStack space="md">
              <HStack className="items-start justify-between">
                <VStack space="xs" className="flex-1">
                  <Heading size="xl" className="text-typography-900">
                    {group.name}
                  </Heading>
                  <HStack space="sm" className="items-center">
                    <Users size={14} color={IconColors.muted} />
                    <Text className="text-sm text-typography-500">
                      {t("groups.memberCount", {
                        count: group.memberCount || 0,
                      })}
                    </Text>
                  </HStack>
                </VStack>
                <Badge
                  action="warning"
                  variant="solid"
                  size="md"
                  className="bg-primary-500"
                >
                  <Trophy size={12} color={IconColors.white} />
                  <BadgeText className="ml-1 text-white">
                    {criteriaLabel}
                  </BadgeText>
                </Badge>
              </HStack>

              {/* Description */}
              {group.description && (
                <Text className="text-sm text-typography-600">
                  {group.description}
                </Text>
              )}

              {/* Action Buttons */}
              <HStack space="sm" className="mt-2 flex-wrap">
                <Button
                  variant="outline"
                  action="secondary"
                  size="sm"
                  onPress={handleShare}
                >
                  <Share2 size={16} color={IconColors.default} />
                  <ButtonText className="ml-1">
                    {t("groups.actions.share")}
                  </ButtonText>
                </Button>
                <Button
                  variant="outline"
                  action="secondary"
                  size="sm"
                  onPress={handleQRCode}
                >
                  <QrCode size={16} color={IconColors.default} />
                  <ButtonText className="ml-1">
                    {t("groups.actions.qrCode")}
                  </ButtonText>
                </Button>
                <Button
                  variant="outline"
                  action="secondary"
                  size="sm"
                  onPress={handleGallery}
                >
                  <Image size={16} color={IconColors.default} />
                  <ButtonText className="ml-1">
                    {t("groups.actions.gallery")}
                  </ButtonText>
                </Button>
                {isCreator && (
                  <Button
                    variant="solid"
                    action="primary"
                    size="sm"
                    onPress={handleSettings}
                  >
                    <Settings size={16} color={IconColors.white} />
                    <ButtonText className="ml-1">
                      {t("groups.actions.settings")}
                    </ButtonText>
                  </Button>
                )}
              </HStack>
            </VStack>
          </Card>

          {/* Leaderboard Section */}
          <VStack space="sm">
            <HStack className="items-center justify-between">
              <Text className="text-sm font-medium text-typography-700">
                {t("groups.detail.leaderboard")}
              </Text>
              {isLoadingLeaderboard && <Spinner size="small" />}
            </HStack>

            <Leaderboard
              entries={(leaderboardData as LeaderboardEntry[]) || []}
              winningCriteria={winningCriteria}
              currentUserId={user?.id}
              emptyMessage={t("groups.detail.noMembers")}
              sortable
              onSortChange={handleSortChange}
              activeSortColumn={sortColumn}
              sortOrder={sortOrder}
            />
          </VStack>
        </VStack>
      </ScrollView>

      {/* Alert Dialog */}
      <AlertDialog isOpen={dialog.isOpen} onClose={closeDialog} size="md">
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading
              size="lg"
              className={
                dialog.type === "destructive"
                  ? "text-error-600"
                  : "text-typography-950"
              }
            >
              {dialog.title}
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-3">
            <Text size="sm" className="text-typography-500">
              {dialog.message}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button action="primary" onPress={closeDialog} className="flex-1">
              <ButtonText>{t("common.buttons.ok")}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Code Sheet */}
      {group && (
        <QRCodeSheet
          isOpen={isQRCodeOpen}
          onClose={() => setIsQRCodeOpen(false)}
          groupId={id!}
          groupName={group.name}
          inviteToken={group.inviteToken}
        />
      )}
    </GestureHandlerRootView>
  );
}
