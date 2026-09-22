import {
  useCancelGroupInvitation,
  useInvitableUsers,
  useInviteToGroup,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { InvitableUser } from "@prostcounter/shared/schemas";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList } from "react-native";

import { Avatar, AvatarFallbackText, AvatarImage } from "@/components/ui/avatar";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

export default function GroupInviteScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = id ?? "";

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, loading } = useInvitableUsers(groupId, debouncedQuery);

  const sortedResults = useMemo(() => {
    if (!results) {
      return [];
    }
    // Members sink to the bottom: there is nothing to do for them
    return [...results].sort((a: InvitableUser, b: InvitableUser) => {
      if (a.invitationStatus === "member" && b.invitationStatus !== "member") return 1;
      if (a.invitationStatus !== "member" && b.invitationStatus === "member") return -1;
      const nameA = (a.fullName || a.username || "").toLowerCase();
      const nameB = (b.fullName || b.username || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [results]);

  const renderItem = useCallback(
    ({ item }: { item: InvitableUser }) => <InviteResultItem user={item} groupId={groupId} />,
    [groupId],
  );

  const keyExtractor = useCallback((item: InvitableUser) => item.id, []);

  const showNoResults = !loading && debouncedQuery.length >= 1 && results?.length === 0;

  return (
    <VStack className="flex-1 bg-background-50">
      <VStack className="px-4 pb-2 pt-4">
        <Input size="lg" variant="rounded">
          <InputSlot className="pl-3">
            <InputIcon as={Search} color={IconColors.muted} />
          </InputSlot>
          <InputField
            autoFocus
            placeholder={t("groups.invitations.searchPlaceholder")}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t("groups.invitations.searchPlaceholder")}
          />
        </Input>
      </VStack>

      {loading && debouncedQuery.length >= 1 && (
        <VStack className="items-center py-8">
          <Spinner size="large" />
        </VStack>
      )}

      {showNoResults && (
        <VStack className="items-center py-8">
          <Text className="text-typography-400">{t("groups.invitations.noResults")}</Text>
        </VStack>
      )}

      <FlatList
        data={sortedResults}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerClassName="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </VStack>
  );
}

function InviteResultItem({ user, groupId }: { user: InvitableUser; groupId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const invite = useInviteToGroup(groupId);
  const cancel = useCancelGroupInvitation(groupId);

  const displayName = user.fullName || user.username || "";

  const handleInvite = useCallback(() => {
    // No error UI on this row; the catch only keeps a failed request from
    // becoming an unhandled rejection.
    invite.mutate(user.id).catch(() => {});
  }, [invite, user.id]);

  const handleCancel = useCallback(() => {
    if (!user.invitationId) {
      return;
    }
    cancel.mutate(user.invitationId).catch(() => {});
  }, [cancel, user.invitationId]);

  // Approving a join request needs the request card's context, which lives on
  // the settings screen. Dismiss back down to it rather than pushing a copy.
  const handleReviewRequest = useCallback(() => {
    router.dismissTo(`/group-detail/${groupId}/settings`);
  }, [router, groupId]);

  const busy = invite.loading || cancel.loading;

  return (
    <HStack className="items-center border-b border-outline-100 py-3" space="md">
      <Avatar size="md">
        {user.avatarUrl ? <AvatarImage source={{ uri: getAvatarUrl(user.avatarUrl) }} /> : null}
        <AvatarFallbackText>{displayName}</AvatarFallbackText>
      </Avatar>

      <VStack className="min-w-0 flex-1">
        {user.fullName ? (
          <Text className="font-semibold text-typography-900" numberOfLines={1}>
            {user.fullName}
          </Text>
        ) : null}
        {user.username ? (
          <Text className="text-sm text-typography-500" numberOfLines={1}>
            @{user.username}
          </Text>
        ) : null}
      </VStack>

      {user.invitationStatus === "none" && (
        <Button
          variant="solid"
          action="primary"
          size="sm"
          onPress={handleInvite}
          disabled={busy}
          accessibilityLabel={t("groups.invitations.invite")}
          accessibilityHint={t("groups.invitations.inviteHint", { name: displayName })}
        >
          {busy ? (
            <ButtonSpinner color={IconColors.white} />
          ) : (
            <ButtonText>{t("groups.invitations.invite")}</ButtonText>
          )}
        </Button>
      )}

      {user.invitationStatus === "invited" && (
        <Button
          variant="outline"
          action="secondary"
          size="sm"
          onPress={handleCancel}
          disabled={busy}
          accessibilityLabel={t("groups.invitations.cancelInvite")}
          accessibilityHint={t("groups.invitations.cancelInviteHint", { name: displayName })}
        >
          {busy ? <ButtonSpinner /> : <ButtonText>{t("groups.invitations.cancelInvite")}</ButtonText>}
        </Button>
      )}

      {user.invitationStatus === "member" && (
        <Text className="text-sm text-typography-400">{t("groups.invitations.member")}</Text>
      )}

      {user.invitationStatus === "requested" && (
        <Button
          variant="outline"
          action="primary"
          size="sm"
          onPress={handleReviewRequest}
          accessibilityLabel={t("groups.invitations.reviewRequest")}
          accessibilityHint={t("groups.invitations.reviewRequestHint", { name: displayName })}
        >
          <ButtonText>{t("groups.invitations.reviewRequest")}</ButtonText>
        </Button>
      )}
    </HStack>
  );
}
