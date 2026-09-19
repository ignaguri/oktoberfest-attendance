import {
  useAdminUser,
  useAdminUserAttendances,
  useDeleteAdminAttendance,
  useDeleteAdminUser,
  useUpdateAdminUserAuth,
  useUpdateAdminUserProfile,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CalendarDays, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";

import { AdminAttendanceList } from "@/components/admin/admin-attendance-list";
import { useAlertDialog } from "@/components/ui/alert-dialog";
import { ConfirmAlertDialog } from "@/components/ui/alert-dialog/confirm";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { ScrollView } from "@/components/ui/scroll-view";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/lib/auth/AuthContext";
import { IconColors, SwitchColors } from "@/lib/constants/colors";

export default function AdminUserDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  const { user, isLoading, error, refetch } = useAdminUser(id);
  const { attendances, isLoading: attendancesLoading } = useAdminUserAttendances(id);

  const updateProfile = useUpdateAdminUserProfile();
  const updateAuth = useUpdateAdminUserAuth();
  const deleteUser = useDeleteAdminUser();
  const deleteAttendance = useDeleteAdminAttendance();

  const [newPassword, setNewPassword] = useState("");

  // An admin editing themselves cannot self-demote or self-delete; the server
  // rejects both, and hiding the controls avoids a confusing 403.
  const isSelf = currentUser?.id === id;

  const handleToggleAdmin = useCallback(
    async (value: boolean) => {
      try {
        await updateProfile.mutate({ userId: id, data: { is_super_admin: value } });
      } catch {
        showDialog(t("common.status.error"), t("admin.mobile.userDetail.updateError"));
      }
    },
    [id, updateProfile, showDialog, t],
  );

  const handleSetPassword = useCallback(() => {
    showDialog(
      t("admin.mobile.userDetail.setPassword"),
      t("admin.mobile.userDetail.setPasswordConfirm"),
      "destructive",
      async () => {
        try {
          await updateAuth.mutate({ userId: id, data: { password: newPassword } });
          setNewPassword("");
          showDialog(t("common.status.success"), t("admin.mobile.userDetail.passwordChanged"));
        } catch {
          showDialog(t("common.status.error"), t("admin.mobile.userDetail.updateError"));
        }
      },
    );
  }, [id, newPassword, updateAuth, showDialog, t]);

  const handleDeleteUser = useCallback(() => {
    showDialog(
      t("admin.mobile.userDetail.deleteUser"),
      t("admin.mobile.userDetail.deleteUserConfirm"),
      "destructive",
      async () => {
        try {
          await deleteUser.mutate(id);
          router.back();
        } catch {
          showDialog(t("common.status.error"), t("admin.mobile.userDetail.deleteError"));
        }
      },
    );
  }, [id, deleteUser, router, showDialog, t]);

  const handleDeleteAttendance = useCallback(
    (attendanceId: string) => {
      showDialog(
        t("admin.mobile.userDetail.deleteAttendance"),
        t("admin.mobile.userDetail.deleteAttendanceConfirm"),
        "destructive",
        async () => {
          try {
            await deleteAttendance.mutate(attendanceId);
          } catch {
            showDialog(t("common.status.error"), t("admin.mobile.userDetail.deleteError"));
          }
        },
      );
    },
    [deleteAttendance, showDialog, t],
  );

  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (isLoading || !user) {
    return (
      <View className="flex-1 items-center justify-center bg-background-50">
        <Text className="text-typography-500">{t("admin.mobile.userDetail.loading")}</Text>
      </View>
    );
  }

  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;

  return (
    <>
      <ScrollView className="flex-1 bg-background-50" contentContainerClassName="p-4">
        <VStack space="md">
          {/* Identity */}
          <Card size="md" variant="elevated">
            <VStack space="xs">
              <Text className="text-lg font-semibold text-typography-900">
                {user.profile?.full_name ||
                  user.profile?.username ||
                  t("admin.mobile.users.noName")}
              </Text>
              {user.profile?.username && (
                <Text className="text-sm text-typography-500">@{user.profile.username}</Text>
              )}
              <Text className="text-sm text-typography-500">{user.email}</Text>
            </VStack>
          </Card>

          {/* Admin flag */}
          <Card size="md" variant="elevated">
            <HStack className="items-center justify-between">
              <VStack className="flex-1 pr-3">
                <Text className="text-typography-900">{t("admin.users.form.isSuperAdmin")}</Text>
                <Text className="text-sm text-typography-500">
                  {isSelf
                    ? t("admin.mobile.userDetail.cannotDemoteSelf")
                    : t("admin.mobile.userDetail.adminHint")}
                </Text>
              </VStack>
              <Switch
                value={user.profile?.is_super_admin === true}
                onValueChange={handleToggleAdmin}
                isDisabled={isSelf || updateProfile.loading}
                trackColor={{ false: SwitchColors.trackOff, true: SwitchColors.trackOn }}
                thumbColor={SwitchColors.thumb}
                accessibilityLabel={t("admin.users.form.isSuperAdmin")}
              />
            </HStack>
          </Card>

          {/* Password reset */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              <Text className="text-typography-900">
                {t("admin.mobile.userDetail.setPassword")}
              </Text>
              <Input isInvalid={passwordTooShort}>
                <InputField
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={t("admin.mobile.userDetail.newPasswordPlaceholder")}
                  secureTextEntry
                  autoCapitalize="none"
                  accessibilityLabel={t("admin.mobile.userDetail.newPasswordPlaceholder")}
                />
              </Input>
              {passwordTooShort && (
                <Text className="text-sm text-error-600">
                  {t("admin.mobile.userDetail.passwordTooShort")}
                </Text>
              )}
              <Button
                variant="outline"
                isDisabled={newPassword.length < 8 || updateAuth.loading}
                onPress={handleSetPassword}
                accessibilityLabel={t("admin.mobile.userDetail.setPassword")}
                accessibilityHint={t("admin.mobile.userDetail.setPasswordHint")}
              >
                {updateAuth.loading && <ButtonSpinner />}
                <ButtonText>{t("admin.mobile.userDetail.setPassword")}</ButtonText>
              </Button>
            </VStack>
          </Card>

          {/* Attendances */}
          <Card size="md" variant="elevated">
            <VStack space="sm">
              <HStack space="sm" className="items-center">
                <CalendarDays size={18} color={IconColors.primary} />
                <Text className="text-typography-900">
                  {t("admin.mobile.userDetail.attendances")}
                </Text>
              </HStack>

              <AdminAttendanceList
                attendances={attendances}
                isLoading={attendancesLoading}
                onDelete={handleDeleteAttendance}
              />
            </VStack>
          </Card>

          {/* Delete account */}
          {!isSelf && (
            <Card size="md" variant="outline" className="border-error-300">
              <VStack space="sm">
                <Text className="text-error-700">{t("admin.mobile.userDetail.dangerZone")}</Text>
                <Button
                  variant="outline"
                  action="negative"
                  isDisabled={deleteUser.loading}
                  onPress={handleDeleteUser}
                  accessibilityLabel={t("admin.mobile.userDetail.deleteUser")}
                  accessibilityHint={t("admin.mobile.userDetail.deleteUserHint")}
                >
                  {deleteUser.loading ? (
                    <ButtonSpinner />
                  ) : (
                    <Trash2 size={16} color={IconColors.error} />
                  )}
                  <ButtonText>{t("admin.mobile.userDetail.deleteUser")}</ButtonText>
                </Button>
              </VStack>
            </Card>
          )}

          <View className="h-4" />
        </VStack>
      </ScrollView>

      <ConfirmAlertDialog dialog={dialog} onClose={closeDialog} />
    </>
  );
}
