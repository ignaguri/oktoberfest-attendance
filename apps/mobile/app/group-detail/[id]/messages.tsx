import { useFestival } from "@prostcounter/shared/contexts";
import {
  useDeleteMessage,
  useGroupMessages,
  useGroupName,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { MessageSquare, Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { ComposeMessage } from "@/components/messages/compose-message";
import { MessageItem } from "@/components/messages/message-item";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  useAlertDialog,
} from "@/components/ui/alert-dialog";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Fab, FabIcon } from "@/components/ui/fab";
import { Heading } from "@/components/ui/heading";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/lib/auth/AuthContext";
import { Colors, IconColors } from "@/lib/constants/colors";

export default function GroupMessagesScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { currentFestival } = useFestival();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Fetch messages
  const {
    messages,
    loading: isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isRefreshing,
    refresh,
    refetch,
  } = useGroupMessages(id || "");

  // Fetch group name for header
  const { data: groupName } = useGroupName(id || "");

  // Delete mutation
  const deleteMutation = useDeleteMessage();

  // Handle delete request
  const handleDeleteRequest = useCallback(
    (messageId: string) => {
      setDeleteTargetId(messageId);
      showDialog(
        t("groups.messages.item.deleteConfirmTitle"),
        t("groups.messages.item.deleteConfirmMessage"),
        "destructive",
      );
    },
    [showDialog, t],
  );

  // Confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    closeDialog();

    try {
      await deleteMutation.mutateAsync({
        messageId: deleteTargetId,
      });
    } catch {
      showDialog(
        t("common.status.error"),
        t("groups.messages.item.deleteError"),
      );
    } finally {
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, deleteMutation, closeDialog, showDialog, t]);

  // Handle compose success
  const handleComposeSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  // Loading state
  if (isLoading && messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Stack.Screen
          options={{
            title: t("groups.messages.title"),
          }}
        />
        <Spinner size="large" />
      </View>
    );
  }

  // Error state
  if (error && messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Stack.Screen
          options={{
            title: t("groups.messages.title"),
          }}
        />
        <ErrorState error={error} onRetry={refetch} />
      </View>
    );
  }

  // Separate pinned and regular messages
  const pinnedMessages = messages.filter((m) => m.pinned);
  const regularMessages = messages.filter((m) => !m.pinned);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: groupName
            ? t("groups.messages.titleWithName", { groupName })
            : t("groups.messages.title"),
        }}
      />

      <ScrollView
        className="flex-1 bg-background-50"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={Colors.primary[500]}
            colors={[Colors.primary[500]]}
          />
        }
      >
        <VStack space="md" className="p-4 pb-24">
          {/* Empty state */}
          {messages.length === 0 && (
            <Card
              variant="outline"
              size="md"
              className="items-center bg-white p-8"
            >
              <MessageSquare size={48} color={IconColors.disabled} />
              <Text className="mt-4 text-center text-lg font-medium text-typography-700">
                {t("groups.messages.empty.title")}
              </Text>
              <Text className="mt-2 text-center text-sm text-typography-500">
                {t("groups.messages.empty.description")}
              </Text>
              <Button
                action="primary"
                className="mt-4"
                onPress={() => setIsComposeOpen(true)}
              >
                <ButtonText>{t("groups.messages.compose.title")}</ButtonText>
              </Button>
            </Card>
          )}

          {/* Pinned Messages */}
          {pinnedMessages.length > 0 && (
            <Card variant="elevated" size="md" className="bg-white">
              <VStack>
                {pinnedMessages.map((message, index) => (
                  <View
                    key={message.id}
                    className={cn(
                      index < pinnedMessages.length - 1 &&
                        "border-b border-outline-100",
                    )}
                  >
                    <MessageItem
                      message={message}
                      currentUserId={user?.id}
                      onDelete={handleDeleteRequest}
                      festivalId={currentFestival?.id}
                    />
                  </View>
                ))}
              </VStack>
            </Card>
          )}

          {/* Regular Messages */}
          {regularMessages.length > 0 && (
            <Card variant="outline" size="md" className="bg-white">
              <VStack>
                {regularMessages.map((message, index) => (
                  <View
                    key={message.id}
                    className={cn(
                      index < regularMessages.length - 1 &&
                        "border-b border-outline-100",
                    )}
                  >
                    <MessageItem
                      message={message}
                      currentUserId={user?.id}
                      onDelete={handleDeleteRequest}
                      festivalId={currentFestival?.id}
                    />
                  </View>
                ))}
              </VStack>
            </Card>
          )}

          {/* Load More */}
          {hasNextPage && (
            <Button
              variant="outline"
              action="secondary"
              size="sm"
              onPress={fetchNextPage}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage && <ButtonSpinner color={Colors.gray[500]} />}
              <ButtonText>
                {isFetchingNextPage
                  ? t("common.status.loading")
                  : t("home.activityFeed.loadMore")}
              </ButtonText>
            </Button>
          )}
        </VStack>
      </ScrollView>

      {/* FAB to compose new message */}
      <Fab
        size="lg"
        placement="bottom right"
        onPress={() => setIsComposeOpen(true)}
        className="bg-primary-500"
        accessibilityLabel={t("groups.messages.compose.title")}
      >
        <FabIcon as={Plus} color={Colors.white} size="xl" />
      </Fab>

      {/* Compose Message Sheet */}
      <ComposeMessage
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        festivalId={currentFestival?.id || ""}
        onSuccess={handleComposeSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={dialog.isOpen && !!deleteTargetId}
        onClose={() => {
          closeDialog();
          setDeleteTargetId(null);
        }}
        size="md"
      >
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="lg" className="text-error-600">
              {dialog.title}
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-3">
            <Text size="sm" className="text-typography-500">
              {dialog.message}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-3">
            <Button
              variant="outline"
              action="secondary"
              onPress={() => {
                closeDialog();
                setDeleteTargetId(null);
              }}
              className="flex-1"
            >
              <ButtonText>{t("common.buttons.cancel")}</ButtonText>
            </Button>
            <Button
              action="negative"
              onPress={handleConfirmDelete}
              className="flex-1"
              disabled={deleteMutation.loading}
            >
              {deleteMutation.loading && <ButtonSpinner color={Colors.white} />}
              <ButtonText>{t("common.buttons.delete")}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GestureHandlerRootView>
  );
}
