import { ApiError } from "@prostcounter/api-client";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { useUpdateAdminUserProfile } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AdminUser } from "@prostcounter/shared/schemas";
import { useCallback, useState } from "react";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;

interface UserIdentityCardProps {
  user: AdminUser;
  onError: (message: string) => void;
}

/**
 * Who the user is, with their name and username editable in place.
 *
 * Email is shown but not edited here: changing it goes through the auth
 * endpoint, which is a credential change rather than a profile one.
 */
export function UserIdentityCard({ user, onError }: UserIdentityCardProps) {
  const { t } = useTranslation();
  const updateProfile = useUpdateAdminUserProfile();

  // Seeded when the admin taps Edit rather than in an effect, so a background
  // refetch of the user cannot overwrite what is being typed.
  const [draft, setDraft] = useState<{ fullName: string; username: string } | null>(null);

  const startEditing = useCallback(() => {
    setDraft({
      fullName: user.profile?.full_name ?? "",
      username: user.profile?.username ?? "",
    });
  }, [user.profile?.full_name, user.profile?.username]);

  const trimmedUsername = draft?.username.trim() ?? "";

  // An empty username clears the column, which the schema allows. A non-empty
  // one has to clear the length bounds the database itself enforces
  // (`username_length` CHECK, plus the schema's 30-character ceiling).
  const usernameInvalid =
    trimmedUsername.length > 0 &&
    (trimmedUsername.length < USERNAME_MIN || trimmedUsername.length > USERNAME_MAX);

  const handleSave = useCallback(async () => {
    if (!draft || usernameInvalid) {
      return;
    }

    const fullName = draft.fullName.trim();

    try {
      await updateProfile.mutate({
        userId: user.id,
        data: {
          full_name: fullName.length > 0 ? fullName : null,
          username: trimmedUsername.length > 0 ? trimmedUsername : null,
        },
      });
      setDraft(null);
    } catch (err) {
      // `profiles.username` is UNIQUE, so this is the one failure the admin can
      // act on: pick another name. Everything else is a generic save error.
      if (err instanceof ApiError && err.code === ErrorCodes.USERNAME_TAKEN) {
        onError(t("apiErrors.USERNAME_TAKEN"));
        return;
      }
      onError(t("admin.mobile.userDetail.updateError"));
    }
  }, [draft, onError, t, trimmedUsername, updateProfile, user.id, usernameInvalid]);

  if (draft) {
    return (
      <Card size="md" variant="elevated">
        <VStack space="sm">
          <Text className="text-sm text-typography-500">
            {t("admin.mobile.userDetail.fullName")}
          </Text>
          <Input>
            <InputField
              value={draft.fullName}
              onChangeText={(fullName) => setDraft({ ...draft, fullName })}
              accessibilityLabel={t("admin.mobile.userDetail.fullName")}
            />
          </Input>

          <Text className="text-sm text-typography-500">
            {t("admin.mobile.userDetail.username")}
          </Text>
          <Input isInvalid={usernameInvalid}>
            <InputField
              value={draft.username}
              onChangeText={(username) => setDraft({ ...draft, username })}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t("admin.mobile.userDetail.username")}
            />
          </Input>
          {usernameInvalid && (
            <Text className="text-sm text-error-600">
              {t("admin.mobile.userDetail.usernameInvalid")}
            </Text>
          )}

          <HStack space="sm">
            <Button
              variant="outline"
              action="secondary"
              className="flex-1"
              onPress={() => setDraft(null)}
              accessibilityLabel={t("common.buttons.cancel")}
            >
              <ButtonText>{t("common.buttons.cancel")}</ButtonText>
            </Button>
            <Button
              className="flex-1"
              isDisabled={usernameInvalid || updateProfile.loading}
              onPress={handleSave}
              accessibilityLabel={t("common.buttons.save")}
            >
              {updateProfile.loading && <ButtonSpinner />}
              <ButtonText>{t("common.buttons.save")}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </Card>
    );
  }

  return (
    <Card size="md" variant="elevated">
      <VStack space="xs">
        <Text className="text-lg font-semibold text-typography-900">
          {user.profile?.full_name || user.profile?.username || t("admin.mobile.users.noName")}
        </Text>
        {user.profile?.username ? (
          <Text className="text-sm text-typography-500">@{user.profile.username}</Text>
        ) : (
          <Text className="text-sm text-typography-400">
            {t("admin.mobile.userDetail.noUsername")}
          </Text>
        )}
        <Text className="text-sm text-typography-500">{user.email}</Text>

        <Button
          variant="outline"
          className="mt-2"
          onPress={startEditing}
          accessibilityLabel={t("admin.mobile.userDetail.editProfile")}
          accessibilityHint={t("admin.mobile.userDetail.editProfileHint")}
        >
          <ButtonText>{t("admin.mobile.userDetail.editProfile")}</ButtonText>
        </Button>
      </VStack>
    </Card>
  );
}
