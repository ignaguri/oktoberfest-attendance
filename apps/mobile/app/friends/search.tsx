import {
  useSearchUsers,
  useSendFriendRequest,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { SearchUserResult } from "@prostcounter/shared/schemas";
import { Search } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList } from "react-native";

import { AddFriendButton } from "@/components/friends/add-friend-button";
import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

export default function FriendSearchScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, loading } = useSearchUsers(debouncedQuery);

  const sortedResults = useMemo(() => {
    if (!results) return [];
    return [...results].sort((a: SearchUserResult, b: SearchUserResult) => {
      if (a.friendshipStatus === "friends" && b.friendshipStatus !== "friends")
        return 1;
      if (a.friendshipStatus !== "friends" && b.friendshipStatus === "friends")
        return -1;
      const nameA = (a.fullName || a.username || "").toLowerCase();
      const nameB = (b.fullName || b.username || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [results]);

  const renderItem = useCallback(
    ({ item }: { item: SearchUserResult }) => <SearchResultItem user={item} />,
    [],
  );

  const keyExtractor = useCallback((item: SearchUserResult) => item.id, []);

  const showNoResults =
    !loading && debouncedQuery.length >= 1 && results?.length === 0;

  return (
    <VStack className="bg-background-50 flex-1">
      <VStack className="px-4 pt-4 pb-2">
        <Input size="lg" variant="rounded">
          <InputSlot className="pl-3">
            <InputIcon as={Search} color={IconColors.muted} />
          </InputSlot>
          <InputField
            autoFocus
            placeholder={t("friends.search.placeholder")}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t("friends.search.placeholder")}
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
          <Text className="text-typography-400">
            {t("friends.search.noResults")}
          </Text>
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

function SearchResultItem({ user }: { user: SearchUserResult }) {
  const sendRequest = useSendFriendRequest();

  const handleSendRequest = useCallback(() => {
    sendRequest.mutate(user.id);
  }, [sendRequest, user.id]);

  const displayName = user.fullName || user.username || "";
  const friendshipStatus = user.friendshipStatus;

  return (
    <HStack
      className="border-outline-100 items-center border-b py-3"
      space="md"
    >
      <Avatar size="md">
        {user.avatarUrl ? (
          <AvatarImage source={{ uri: getAvatarUrl(user.avatarUrl) }} />
        ) : null}
        <AvatarFallbackText>{displayName}</AvatarFallbackText>
      </Avatar>

      <VStack className="min-w-0 flex-1">
        {user.fullName ? (
          <Text className="text-typography-900 font-semibold" numberOfLines={1}>
            {user.fullName}
          </Text>
        ) : null}
        {user.username ? (
          <Text className="text-typography-500 text-sm" numberOfLines={1}>
            @{user.username}
          </Text>
        ) : null}
      </VStack>

      <AddFriendButton
        status={friendshipStatus}
        onPress={handleSendRequest}
        loading={sendRequest.loading}
        size="sm"
      />
    </HStack>
  );
}
