import { useUserGroups } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { Plus, UserPlus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import type { GroupWithMembers } from "@prostcounter/shared/schemas";

import { CreateGroupSheet } from "@/components/groups/create-group-sheet";
import { EmptyGroupsState } from "@/components/groups/empty-groups-state";
import { GroupListItem } from "@/components/groups/group-list-item";
import { JoinGroupSheet } from "@/components/groups/join-group-sheet";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  useAlertDialog,
} from "@/components/ui/alert-dialog";
import { Button, ButtonText } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { useFestival } from "@/lib/festival/FestivalContext";

export default function GroupsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentFestival } = useFestival();

  // Dialog state
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  // Sheet states
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false);

  // Data hooks
  const {
    data: groups,
    loading: isLoading,
    error: groupsError,
    refetch,
    isRefetching,
  } = useUserGroups(currentFestival?.id ?? "");

  // Handlers
  const handleGroupPress = useCallback(
    (groupId: string) => {
      router.push(`/groups/${groupId}`);
    },
    [router],
  );

  const handleCreatePress = useCallback(() => {
    setIsCreateSheetOpen(true);
  }, []);

  const handleJoinPress = useCallback(() => {
    setIsJoinSheetOpen(true);
  }, []);

  const handleCreateSuccess = useCallback(
    (groupId: string) => {
      refetch();
      setIsCreateSheetOpen(false);
      showDialog(
        t("common.status.success"),
        t("groups.createSuccess", { defaultValue: "Group created successfully!" }),
      );
      // Navigate to the new group
      router.push(`/groups/${groupId}`);
    },
    [refetch, showDialog, t, router],
  );

  const handleJoinSuccess = useCallback(() => {
    refetch();
    setIsJoinSheetOpen(false);
    showDialog(
      t("common.status.success"),
      t("groups.joinSuccess", { defaultValue: "Successfully joined the group!" }),
    );
  }, [refetch, showDialog, t]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // No festival selected
  if (!currentFestival) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50 p-6">
        <Text className="text-center text-typography-500">
          {t("groups.noFestival", {
            defaultValue: "Please select a festival to view groups.",
          })}
        </Text>
      </View>
    );
  }

  // Loading state - only show full-page spinner on initial load
  if (isLoading && !groups) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Spinner size="large" />
      </View>
    );
  }

  // Error state
  if (groupsError) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <ErrorState error={groupsError} onRetry={refetch} />
      </View>
    );
  }

  const groupsList = (groups as GroupWithMembers[]) || [];
  const hasGroups = groupsList.length > 0;

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
        {hasGroups ? (
          <VStack space="md" className="p-4">
            {/* Header with action buttons */}
            <HStack className="items-center justify-between">
              <Text className="text-sm text-typography-500">
                {t("groups.yourGroups", { defaultValue: "Your Groups" })}
              </Text>
              <HStack space="sm">
                <Button
                  variant="outline"
                  action="secondary"
                  size="sm"
                  onPress={handleJoinPress}
                >
                  <UserPlus size={16} color={IconColors.default} />
                  <ButtonText className="ml-1">
                    {t("groups.actions.join", { defaultValue: "Join" })}
                  </ButtonText>
                </Button>
                <Button
                  variant="solid"
                  action="primary"
                  size="sm"
                  onPress={handleCreatePress}
                >
                  <Plus size={16} color={IconColors.white} />
                  <ButtonText className="ml-1">
                    {t("groups.actions.create", { defaultValue: "Create" })}
                  </ButtonText>
                </Button>
              </HStack>
            </HStack>

            {/* Groups list */}
            <VStack space="sm">
              {groupsList.map((group) => (
                <GroupListItem
                  key={group.id}
                  group={group}
                  onPress={handleGroupPress}
                />
              ))}
            </VStack>
          </VStack>
        ) : (
          <EmptyGroupsState
            onCreateGroup={handleCreatePress}
            onJoinGroup={handleJoinPress}
          />
        )}
      </ScrollView>

      {/* Create Group Sheet */}
      <CreateGroupSheet
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
        festivalId={currentFestival.id}
        onSuccess={handleCreateSuccess}
      />

      {/* Join Group Sheet */}
      <JoinGroupSheet
        isOpen={isJoinSheetOpen}
        onClose={() => setIsJoinSheetOpen(false)}
        festivalId={currentFestival.id}
        onSuccess={handleJoinSuccess}
      />

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
    </GestureHandlerRootView>
  );
}
