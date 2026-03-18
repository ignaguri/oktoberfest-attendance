import {
  useFriendshipStatus,
  useSearchUsers,
  useSendFriendRequest,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Search } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
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

interface SearchUser {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export default function FriendSearchScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, loading } = useSearchUsers(debouncedQuery);

  const renderItem = useCallback(
    ({ item }: { item: SearchUser }) => <SearchResultItem user={item} />,
    [],
  );

  const keyExtractor = useCallback((item: SearchUser) => item.id, []);

  const showNoResults =
    !loading && debouncedQuery.length >= 1 && results?.length === 0;

  return (
    <VStack className="flex-1 bg-background-50">
      <VStack className="px-4 pb-2 pt-4">
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
        data={results ?? []}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerClassName="px-4 pb-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </VStack>
  );
}

function SearchResultItem({ user }: { user: SearchUser }) {
  const { data: status, loading: statusLoading } = useFriendshipStatus(user.id);
  const sendRequest = useSendFriendRequest();

  const handleSendRequest = useCallback(() => {
    sendRequest.mutate(user.id);
  }, [sendRequest, user.id]);

  const displayName = user.fullName || user.username || "";
  const friendshipStatus = status?.status ?? "none";

  return (
    <HStack
      className="items-center border-b border-outline-100 py-3"
      space="md"
    >
      <Avatar size="md">
        {user.avatarUrl ? (
          <AvatarImage source={{ uri: user.avatarUrl }} />
        ) : null}
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

      <AddFriendButton
        status={friendshipStatus}
        onPress={handleSendRequest}
        loading={sendRequest.loading || statusLoading}
        size="sm"
      />
    </HStack>
  );
}
