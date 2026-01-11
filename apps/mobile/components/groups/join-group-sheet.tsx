import {
  useGroupSearch,
  useJoinGroup,
  useJoinGroupByToken,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { X, Search, Key, Users, ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

import type { SearchGroupResult } from "@prostcounter/shared/schemas";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

type JoinMode = "search" | "token";

interface JoinGroupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  festivalId: string;
  onSuccess: () => void;
}

export function JoinGroupSheet({
  isOpen,
  onClose,
  festivalId,
  onSuccess,
}: JoinGroupSheetProps) {
  const { t } = useTranslation();
  const joinGroup = useJoinGroup();
  const joinGroupByToken = useJoinGroupByToken();

  // UI State
  const [mode, setMode] = useState<JoinMode>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<SearchGroupResult | null>(
    null,
  );
  const [inviteToken, setInviteToken] = useState("");

  // Search query - debounced via React Query
  const { data: searchResults, loading: isSearching } = useGroupSearch(
    searchQuery,
    festivalId,
  );

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMode("search");
      setSearchQuery("");
      setSelectedGroup(null);
      setInviteToken("");
    }
  }, [isOpen]);

  // Handle joining a group
  const handleJoin = useCallback(async () => {
    try {
      if (mode === "search" && selectedGroup) {
        // Join via search: use groupId + inviteToken
        await joinGroup.mutateAsync({
          groupId: selectedGroup.id,
          inviteToken: inviteToken,
        });
      } else if (mode === "token" && inviteToken) {
        // Join via token only: use the joinByToken endpoint
        await joinGroupByToken.mutateAsync(inviteToken);
      }

      onSuccess();
    } catch (error) {
      console.error("Failed to join group:", error);
    }
  }, [
    mode,
    selectedGroup,
    inviteToken,
    joinGroup,
    joinGroupByToken,
    onSuccess,
  ]);

  const handleGroupSelect = useCallback((group: SearchGroupResult) => {
    setSelectedGroup(group);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedGroup(null);
    setInviteToken("");
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const isJoining = joinGroup.loading || joinGroupByToken.loading;
  const canJoin =
    mode === "search"
      ? selectedGroup && inviteToken.length > 0
      : inviteToken.length > 0;

  // Search Results View
  const renderSearchResults = () => {
    const results = (searchResults as SearchGroupResult[]) || [];

    if (isSearching) {
      return (
        <VStack className="items-center py-8">
          <ActivityIndicator color={Colors.primary[500]} />
          <Text className="mt-2 text-sm text-typography-500">
            {t("groups.join.searching", {
              defaultValue: "Searching groups...",
            })}
          </Text>
        </VStack>
      );
    }

    if (searchQuery.length >= 2 && results.length === 0) {
      return (
        <VStack className="items-center py-8">
          <Users size={48} color={IconColors.disabled} />
          <Text className="mt-2 text-sm text-typography-500">
            {t("groups.join.noResults", { defaultValue: "No groups found" })}
          </Text>
        </VStack>
      );
    }

    if (results.length > 0) {
      return (
        <VStack space="sm">
          {results.map((group) => (
            <Pressable key={group.id} onPress={() => handleGroupSelect(group)}>
              <Card variant="outline" size="sm" className="bg-background-0">
                <HStack className="items-center justify-between">
                  <VStack space="xs">
                    <Text className="font-medium text-typography-900">
                      {group.name}
                    </Text>
                    <HStack space="xs" className="items-center">
                      <Users size={12} color={IconColors.muted} />
                      <Text className="text-xs text-typography-500">
                        {t("groups.memberCount", {
                          count: group.memberCount,
                          defaultValue: "{{count}} members",
                        })}
                      </Text>
                    </HStack>
                  </VStack>
                  <ChevronRight size={20} color={IconColors.muted} />
                </HStack>
              </Card>
            </Pressable>
          ))}
        </VStack>
      );
    }

    return (
      <VStack className="items-center py-8">
        <Search size={48} color={IconColors.disabled} />
        <Text className="mt-2 text-center text-sm text-typography-500">
          {t("groups.join.searchPrompt", {
            defaultValue: "Search for a group by name to join",
          })}
        </Text>
      </VStack>
    );
  };

  // Token Input View (for selected group or token-only mode)
  const renderTokenInput = () => (
    <VStack space="lg">
      {selectedGroup && (
        <Card variant="elevated" size="md" className="bg-background-0">
          <VStack space="sm">
            <Text className="font-semibold text-typography-900">
              {selectedGroup.name}
            </Text>
            <HStack space="xs" className="items-center">
              <Users size={14} color={IconColors.muted} />
              <Text className="text-sm text-typography-500">
                {t("groups.memberCount", {
                  count: selectedGroup.memberCount,
                  defaultValue: "{{count}} members",
                })}
              </Text>
            </HStack>
          </VStack>
        </Card>
      )}

      <VStack space="sm">
        <Text className="text-sm font-medium text-typography-700">
          {t("groups.join.tokenLabel", { defaultValue: "Invite Token" })}
        </Text>
        <Input size="md">
          <InputSlot className="pl-3">
            <InputIcon as={Key} color={IconColors.muted} />
          </InputSlot>
          <InputField
            placeholder={t("groups.join.tokenPlaceholder", {
              defaultValue: "Enter invite token",
            })}
            value={inviteToken}
            onChangeText={setInviteToken}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Input>
        <Text className="text-xs text-typography-400">
          {t("groups.join.tokenHelp", {
            defaultValue: "Ask the group admin for the invite token",
          })}
        </Text>
      </VStack>

      {/* Action Buttons */}
      <HStack className="w-full gap-3">
        <Button
          variant="outline"
          action="secondary"
          className="flex-1"
          onPress={selectedGroup ? handleBack : handleClose}
          isDisabled={isJoining}
        >
          <ButtonText>
            {selectedGroup
              ? t("common.buttons.back", { defaultValue: "Back" })
              : t("common.buttons.cancel")}
          </ButtonText>
        </Button>
        <Button
          variant="solid"
          action="primary"
          className="flex-1"
          onPress={handleJoin}
          isDisabled={!canJoin || isJoining}
        >
          {isJoining && <ButtonSpinner color={Colors.white} />}
          <ButtonText>
            {isJoining
              ? t("groups.join.joining", { defaultValue: "Joining..." })
              : t("groups.actions.join", { defaultValue: "Join Group" })}
          </ButtonText>
        </Button>
      </HStack>
    </VStack>
  );

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85%]">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header */}
        <HStack className="mb-4 w-full items-center justify-between px-2">
          <Text className="text-lg font-semibold text-typography-900">
            {t("groups.join.title", { defaultValue: "Join Group" })}
          </Text>
          <Pressable onPress={handleClose} hitSlop={8}>
            <X size={24} color={IconColors.default} />
          </Pressable>
        </HStack>

        <ActionsheetScrollView className="w-full">
          <VStack space="lg" className="px-2 pb-4">
            {/* Mode Toggle */}
            <HStack space="sm" className="w-full">
              <Button
                variant={mode === "search" ? "solid" : "outline"}
                action={mode === "search" ? "primary" : "secondary"}
                size="sm"
                className="flex-1"
                onPress={() => {
                  setMode("search");
                  setSelectedGroup(null);
                  setInviteToken("");
                }}
              >
                <Search
                  size={16}
                  color={
                    mode === "search" ? IconColors.white : IconColors.default
                  }
                />
                <ButtonText className="ml-1">
                  {t("groups.join.searchMode", { defaultValue: "Search" })}
                </ButtonText>
              </Button>
              <Button
                variant={mode === "token" ? "solid" : "outline"}
                action={mode === "token" ? "primary" : "secondary"}
                size="sm"
                className="flex-1"
                onPress={() => {
                  setMode("token");
                  setSearchQuery("");
                  setSelectedGroup(null);
                }}
              >
                <Key
                  size={16}
                  color={
                    mode === "token" ? IconColors.white : IconColors.default
                  }
                />
                <ButtonText className="ml-1">
                  {t("groups.join.tokenMode", { defaultValue: "Invite Token" })}
                </ButtonText>
              </Button>
            </HStack>

            {mode === "search" && !selectedGroup ? (
              <>
                {/* Search Input */}
                <Input size="md">
                  <InputSlot className="pl-3">
                    <InputIcon as={Search} color={IconColors.muted} />
                  </InputSlot>
                  <InputField
                    placeholder={t("groups.join.searchPlaceholder", {
                      defaultValue: "Search by group name",
                    })}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </Input>

                {/* Search Results */}
                {renderSearchResults()}
              </>
            ) : (
              renderTokenInput()
            )}
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

JoinGroupSheet.displayName = "JoinGroupSheet";
