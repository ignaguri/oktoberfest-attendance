import { useAdminUsers } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Search, ShieldCheck, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { RefreshControl } from "react-native";

import { Alert, AlertText } from "@/components/ui/alert";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField, InputIcon, InputSlot } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

/** Each distinct term is a cache entry and a directory walk, so typing is debounced. */
const SEARCH_DEBOUNCE_MS = 400;

export default function AdminUsersScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { users, totalCount, totalPages, truncated, isLoading, error, refetch, isRefetching } =
    useAdminUsers(search || undefined, page);

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <ScrollView
      className="flex-1 bg-background-50"
      contentContainerClassName="p-4"
      refreshControl={<RefreshControl refreshing={isRefetching ?? false} onRefresh={refetch} />}
      keyboardShouldPersistTaps="handled"
    >
      <VStack space="md">
        <Input>
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={t("admin.mobile.users.searchPlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("admin.mobile.users.searchPlaceholder")}
          />
        </Input>

        {truncated && (
          <Alert action="warning" variant="outline">
            <AlertText size="sm">{t("admin.mobile.users.truncated")}</AlertText>
          </Alert>
        )}

        {isLoading && (
          <Text className="text-typography-500">{t("admin.mobile.users.loading")}</Text>
        )}

        {!isLoading && users.length === 0 && (
          <Card size="md" variant="elevated">
            <VStack space="xs" className="items-center py-6">
              <Users size={32} color={IconColors.muted} />
              <Text className="text-typography-500">{t("admin.mobile.users.empty")}</Text>
            </VStack>
          </Card>
        )}

        {users.length > 0 && (
          <Text className="text-sm text-typography-500">
            {t("admin.mobile.users.resultCount", { count: totalCount })}
          </Text>
        )}

        {users.map((user) => (
          <Pressable
            key={user.id}
            onPress={() => router.push(`/admin/user/${user.id}`)}
            accessibilityRole="button"
            accessibilityLabel={user.profile?.username || user.email || user.id}
            accessibilityHint={t("admin.mobile.users.openHint")}
          >
            <Card size="md" variant="elevated">
              <HStack className="items-center justify-between">
                <VStack space="xs" className="flex-1">
                  <HStack space="sm" className="items-center">
                    <Text className="font-semibold text-typography-900">
                      {user.profile?.full_name ||
                        user.profile?.username ||
                        t("admin.mobile.users.noName")}
                    </Text>
                    {user.profile?.is_super_admin && (
                      <Badge action="warning" size="sm">
                        <ShieldCheck size={12} color={IconColors.primary} />
                        <BadgeText>{t("admin.mobile.users.adminBadge")}</BadgeText>
                      </Badge>
                    )}
                  </HStack>
                  {user.profile?.username && (
                    <Text className="text-sm text-typography-500">@{user.profile.username}</Text>
                  )}
                  <Text className="text-sm text-typography-400">{user.email}</Text>
                </VStack>
                <ChevronRight size={20} color={IconColors.muted} />
              </HStack>
            </Card>
          </Pressable>
        ))}

        {totalPages > 1 && (
          <HStack space="md" className="items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              isDisabled={page <= 1}
              onPress={() => setPage((current) => Math.max(1, current - 1))}
              accessibilityLabel={t("admin.mobile.users.previousPage")}
            >
              <ChevronLeft size={16} color={IconColors.default} />
              <ButtonText>{t("admin.mobile.users.previousPage")}</ButtonText>
            </Button>

            <Text className="text-sm text-typography-500">
              {t("admin.mobile.users.pageOf", { page, totalPages })}
            </Text>

            <Button
              variant="outline"
              size="sm"
              isDisabled={page >= totalPages}
              onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
              accessibilityLabel={t("admin.mobile.users.nextPage")}
            >
              <ButtonText>{t("admin.mobile.users.nextPage")}</ButtonText>
              <ChevronRight size={16} color={IconColors.default} />
            </Button>
          </HStack>
        )}

        <View className="h-4" />
      </VStack>
    </ScrollView>
  );
}
